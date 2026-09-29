import random
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.post import Post
from app.models.comment import Comment
from app.models.metric_snapshot import MetricSnapshot
from app.models.alert import Alert
from app.models.watchlist import WatchlistItem
from app.services.privacy_service import hash_commenter_id
from app.services.link_service import build_youtube_video_url, build_youtube_comment_url, build_twitter_url

logger = logging.getLogger(__name__)

HINDI_NEGATIVE_COMMENTS = [
    "सम्राट चौधरी जी केवल बातें करते हैं, बिहार में कोई विकास नहीं दिख रहा।",
    "पेपर लीक पर सरकार पूरी तरह नाकाम साबित हुई है। युवाओं का भविष्य बर्बाद हो रहा है।",
    "कानून व्यवस्था की हालत दिन-प्रतिदिन खराब होती जा रही है, सीएम साहब ध्यान दें।",
    "बाढ़ राहत का पैसा आज तक पीड़ितों तक नहीं पहुंचा, यह सरासर भ्रष्टाचार है।",
    "स्वास्थ्य व्यवस्था बदहाल है, अस्पतालों में न डॉक्टर हैं न दवाएं।",
    "का हो सम्राट बाबू, खाली भाषण देब कि कुछ कामो करब?",
    "बेरोजगारी चरम पर है और सीएम साहब रैलियों में व्यस्त हैं।",
    "पटना में जाम और प्रदूषण का कोई समाधान नहीं निकल रहा।",
    "सड़कें बनते ही टूट जा रही हैं, ठेकेदारों की मिलीभगत साफ दिख रही है।",
    "बिजली बिल इतना बढ़ गया है कि आम जनता परेशान हो चुकी है।"
]

HINGLISH_NEGATIVE_COMMENTS = [
    "CM Samrat Choudhary has completely failed to control crime in rural Bihar.",
    "Bihari youth need real industry and jobs, not empty political slogans!",
    "Teacher recruitment exam me fir se ghotala hua hai, action kab hoga?",
    "Patna flood management is an absolute disaster every single monsoon.",
    "Law and order situation is deteriorating rapidly under this administration.",
    "Hospital me koi suvidha nahi hai, bas publicity stunt chal raha hai.",
    "Kuchh vikas nahi hua hai, sab fake claims hain government ke.",
    "Zero ground level implementation of election promises.",
    "Electricity rates are sky high and power cuts continue daily.",
    "Roads constructed last year are already full of potholes, total corruption."
]

HINDI_POSITIVE_COMMENTS = [
    "माननीय मुख्यमंत्री सम्राट चौधरी जी के नेतृत्व में बिहार तेजी से प्रगति कर रहा है।",
    "अपराधियों पर सख्त कार्रवाई के लिए सीएम साहब का बहुत-बहुत धन्यवाद।",
    "पटना मेट्रो और एक्सप्रेसवे के काम में जो तेजी आई है वह सराहनीय है।",
    "शिक्षा सुधार की दिशा में सरकार का यह कदम ऐतिहासिक है।",
    "उद्योग नीति 2026 से बिहार में नए निवेश के रास्ते खुल रहे हैं।",
    "सम्राट भैया का काम बोलता है, जय बिहार!",
    "ग्रामीण सड़कों का कायाकल्प हो रहा है, आभार सीएम जी।",
    "अस्पतालों में डॉक्टरों की समय पर उपस्थिति अब सुनिश्चित हो रही है।"
]

HINGLISH_POSITIVE_COMMENTS = [
    "Great initiative by CM Samrat Choudhary for the expressway connectivity.",
    "Patna Metro project speeded up tremendously under his direct monitoring.",
    "Finally police is taking stern action against criminal mafias.",
    "New industrial policy will definitely bring IT parks to Bihar.",
    "Bihari diaspora is proud to see decisive leadership in Patna."
]

NEUTRAL_COMMENTS = [
    "Let us wait and see the audit report before jumping to conclusions.",
    "सरकार को इस योजना पर सर्वदलीय बैठक बुलानी चाहिए।",
    "Notification was released yesterday, check the official website.",
    "Public transport frequency should be increased during festival rush.",
    "When will the next assembly session begin to discuss this bill?"
]

TOPICS = [
    "law & order", "jobs", "education", "floods", "corruption",
    "development", "caste/religion", "party politics", "other"
]

async def seed_database(db: AsyncSession, generate_alert_post: bool = True):
    """
    Seeds database with realistic synthetic posts, metrics, and comments across
    Hindi, Hinglish, Bhojpuri, and English.
    Includes a post designed to cross the 500 negative comments threshold (501 negative comments)
    to test the alerting system out of the box.
    """
    logger.info("Starting database seeding...")

    # Clear existing synthetic posts to ensure idempotent clean seed
    await db.execute(delete(Alert))
    await db.execute(delete(MetricSnapshot))
    await db.execute(delete(Comment))
    await db.execute(delete(Post))
    await db.execute(delete(WatchlistItem))

    now = datetime.now(timezone.utc)

    # 1. Seed Watchlist items
    watchlist = [
        WatchlistItem(item_type="keyword", value="Samrat Choudhary", display_name="Samrat Choudhary (EN)", label="neutral"),
        WatchlistItem(item_type="keyword", value="सम्राट चौधरी", display_name="सम्राट चौधरी (HI)", label="neutral"),
        WatchlistItem(item_type="keyword", value="CM Samrat", display_name="CM Samrat", label="neutral"),
        WatchlistItem(item_type="handle", platform="youtube", value="SamratChoudharyBJP", display_name="Samrat Choudhary Official", label="official"),
        WatchlistItem(item_type="handle", platform="youtube", value="BiharTakOfficial", display_name="Bihar Tak", label="news-media"),
        WatchlistItem(item_type="handle", platform="youtube", value="News18BiharJharkhand", display_name="News18 Bihar Jharkhand", label="news-media"),
        WatchlistItem(item_type="handle", platform="youtube", value="ZeeBiharJharkhand", display_name="Zee Bihar Jharkhand", label="news-media"),
        WatchlistItem(item_type="handle", platform="youtube", value="KashishNewsBihar", display_name="Kashish News Bihar", label="news-media"),
        WatchlistItem(item_type="handle", platform="youtube", value="LiveCitiesMedia", display_name="Live Cities Media", label="news-media"),
        WatchlistItem(item_type="handle", platform="youtube", value="News4Nation", display_name="News4Nation", label="news-media"),
        WatchlistItem(item_type="handle", platform="youtube", value="ABPNews", display_name="ABP News Bihar", label="news-media"),
        WatchlistItem(item_type="handle", platform="youtube", value="PrabhatKhabarOfficial", display_name="Prabhat Khabar", label="news-media"),
        WatchlistItem(item_type="handle", platform="twitter", value="samrat4bjp", display_name="Samrat Choudhary Twitter", label="official"),
        WatchlistItem(item_type="handle", platform="twitter", value="RJDforIndia", display_name="RJD Official", label="opposition")
    ]
    for w in watchlist:
        db.add(w)

    posts_to_create = []

    # Post 1: The Critical Alert Post (Viral Controversy with 501 negative comments)
    yt_critical_id = "li5ptLL5Vyo"  # Real Bihar Tak video
    p1 = Post(
        platform="youtube",
        platform_item_id=yt_critical_id,
        author_handle="BiharTakOfficial",
        author_name="Bihar Tak",
        author_label="news-media",
        permalink_url=build_youtube_video_url(yt_critical_id),
        canonical_url=build_youtube_video_url(yt_critical_id),
        text="बिहार में बाढ़ राहत सामग्री वितरण पर जनता में भारी नाराजगी, सीएम सम्राट चौधरी से तीखे सवाल | Ground Report",
        media_type="video",
        language="hi",
        posted_at=now - timedelta(hours=36),
        first_seen_at=now - timedelta(hours=36),
        last_checked_at=now,
        link_status="active",
        sentiment_verdict="Negative",
        sentiment_score=-82.5,
        confidence=0.94,
        top_topic="floods",
        views=452000,
        likes=8200,
        shares=1450,
        comment_count=525,
        negative_comment_count=505,
        positive_comment_count=12,
        neutral_comment_count=8,
        mixed_comment_count=0,
        negative_comment_pct=96.19,
        growth_velocity=42.5,
        alert_flag=True,
        alert_milestone=500,
        matched_keywords=["सम्राट चौधरी", "Samrat Choudhary"]
    )
    posts_to_create.append(p1)

    # Post 2: Highly Positive Pro-CM Development Post
    yt_positive_id = "ffUdIc2UcQo"  # Real Samrat Choudhary video
    p2 = Post(
        platform="youtube",
        platform_item_id=yt_positive_id,
        author_handle="SamratChoudharyBJP",
        author_name="Samrat Choudhary Official",
        author_label="official",
        permalink_url=build_youtube_video_url(yt_positive_id),
        canonical_url=build_youtube_video_url(yt_positive_id),
        text="पटना मेट्रो प्रायोरिटी कॉरिडोर का स्थलीय निरीक्षण: तय समय सीमा से पहले शुरू होगा परिचालन - मुख्यमंत्री सम्राट चौधरी",
        media_type="video",
        language="hi",
        posted_at=now - timedelta(days=2),
        first_seen_at=now - timedelta(days=2),
        last_checked_at=now,
        link_status="active",
        sentiment_verdict="Positive",
        sentiment_score=88.0,
        confidence=0.96,
        top_topic="development",
        views=215000,
        likes=19400,
        shares=3200,
        comment_count=180,
        negative_comment_count=15,
        positive_comment_count=152,
        neutral_comment_count=13,
        mixed_comment_count=0,
        negative_comment_pct=8.33,
        growth_velocity=12.0,
        alert_flag=False,
        alert_milestone=0,
        matched_keywords=["मुख्यमंत्री सम्राट चौधरी", "Samrat Choudhary"]
    )
    posts_to_create.append(p2)

    # Post 3: X (Twitter) Post from Opposition Critic
    tw_opp_id = "177218903429188096"
    p3 = Post(
        platform="twitter",
        platform_item_id=tw_opp_id,
        author_handle="yadavtejashwi",
        author_name="Tejashwi Yadav",
        author_label="opposition",
        permalink_url=build_twitter_url(tw_opp_id),
        canonical_url=build_twitter_url(tw_opp_id),
        text="बिहार में स्वास्थ्य सेवाओं की पोल खुल गई है। अस्पतालों में बेड नहीं हैं और सीएम सम्राट चौधरी केवल भाषणबाजी कर रहे हैं। #BiharHealthEmergency",
        media_type="tweet",
        language="hi",
        posted_at=now - timedelta(hours=14),
        first_seen_at=now - timedelta(hours=14),
        last_checked_at=now,
        link_status="active",
        sentiment_verdict="Negative",
        sentiment_score=-76.0,
        confidence=0.91,
        top_topic="corruption",
        views=320000,
        likes=14500,
        shares=4100,
        comment_count=380,
        negative_comment_count=290,
        positive_comment_count=70,
        neutral_comment_count=20,
        mixed_comment_count=0,
        negative_comment_pct=76.31,
        growth_velocity=28.0,
        alert_flag=False, # Below 500
        alert_milestone=0,
        matched_keywords=["सम्राट चौधरी", "Bihar CM"]
    )
    posts_to_create.append(p3)

    # Post 4: Neutral Educational Policy Discussion
    yt_edu_id = "pZXyLS4Wj6g"  # Real Aaj Tak Bihar video
    p4 = Post(
        platform="youtube",
        platform_item_id=yt_edu_id,
        author_handle="AajTakBihar",
        author_name="Bihar Education Portal",
        author_label="neutral",
        permalink_url=build_youtube_video_url(yt_edu_id),
        canonical_url=build_youtube_video_url(yt_edu_id),
        text="Bihar Teacher & Police Recruitment: CM Samrat Choudhary approves new digital exam center guidelines across 38 districts.",
        media_type="video",
        language="en",
        posted_at=now - timedelta(days=3),
        first_seen_at=now - timedelta(days=3),
        last_checked_at=now,
        link_status="active",
        sentiment_verdict="Neutral",
        sentiment_score=5.0,
        confidence=0.85,
        top_topic="jobs",
        views=95000,
        likes=4200,
        shares=850,
        comment_count=65,
        negative_comment_count=18,
        positive_comment_count=22,
        neutral_comment_count=25,
        mixed_comment_count=0,
        negative_comment_pct=27.69,
        growth_velocity=4.5,
        alert_flag=False,
        alert_milestone=0,
        matched_keywords=["CM Samrat"]
    )
    posts_to_create.append(p4)

    # Post 5: Deleted / Unavailable Post to demonstrate Link Health handling
    yt_del_id = "v_deleted_rumor_clip_99"
    p5 = Post(
        platform="youtube",
        platform_item_id=yt_del_id,
        author_handle="ViralVideoPatna",
        author_name="Viral Patna News",
        author_label="neutral",
        permalink_url=build_youtube_video_url(yt_del_id),
        canonical_url=build_youtube_video_url(yt_del_id),
        text="Exclusive footage of cabinet meeting regarding Bihar industrial corridor - [Video Removed by Uploader]",
        media_type="video",
        language="en",
        posted_at=now - timedelta(days=5),
        first_seen_at=now - timedelta(days=5),
        last_checked_at=now,
        link_status="unavailable", # Marked as unavailable
        sentiment_verdict="Mixed",
        sentiment_score=0.0,
        confidence=0.70,
        top_topic="development",
        views=12000,
        likes=300,
        shares=40,
        comment_count=15,
        negative_comment_count=5,
        positive_comment_count=5,
        neutral_comment_count=5,
        mixed_comment_count=0,
        negative_comment_pct=33.33,
        growth_velocity=0.0,
        alert_flag=False,
        alert_milestone=0,
        matched_keywords=["Bihar CM"]
    )
    posts_to_create.append(p5)

    # Post 6: News18 Bihar Jharkhand (Law & Order Focus, Moderately Supportive)
    yt_n18_id = "Bjuf7zWM_U4"  # Real News18 video
    p6 = Post(
        platform="youtube",
        platform_item_id=yt_n18_id,
        author_handle="News18BiharJharkhand",
        author_name="News18 Bihar Jharkhand",
        author_label="news-media",
        permalink_url=build_youtube_video_url(yt_n18_id),
        canonical_url=build_youtube_video_url(yt_n18_id),
        text="सीएम सम्राट चौधरी की पुलिस अधिकारियों को दो टूक: कानून व्यवस्था से कोई समझौता नहीं, अपराध पर जीरो टॉलरेंस नीति लागू होगी | News18 Bihar",
        media_type="video",
        language="hi",
        posted_at=now - timedelta(days=1, hours=8),
        first_seen_at=now - timedelta(days=1, hours=8),
        last_checked_at=now,
        link_status="active",
        sentiment_verdict="Positive",
        sentiment_score=45.0,
        confidence=0.92,
        top_topic="law & order",
        views=385000,
        likes=16500,
        shares=2100,
        comment_count=240,
        negative_comment_count=55,
        positive_comment_count=165,
        neutral_comment_count=20,
        mixed_comment_count=0,
        negative_comment_pct=22.92,
        growth_velocity=18.5,
        alert_flag=False,
        alert_milestone=0,
        matched_keywords=["सीएम सम्राट चौधरी", "Samrat Choudhary"]
    )
    posts_to_create.append(p6)

    # Post 7: Zee Bihar Jharkhand (Jobs & BPSC Controversy, Critical Stance)
    yt_zee_id = "_Idv7Hu2YQg"  # Real Zee Bihar Jharkhand video
    p7 = Post(
        platform="youtube",
        platform_item_id=yt_zee_id,
        author_handle="ZeeBiharJharkhand",
        author_name="Zee Bihar Jharkhand",
        author_label="news-media",
        permalink_url=build_youtube_video_url(yt_zee_id),
        canonical_url=build_youtube_video_url(yt_zee_id),
        text="बिहार शिक्षक व BPSC परीक्षा पर सीएम सम्राट चौधरी का बड़ा बयान, अभ्यर्थियों की मांगों पर बनी उच्चस्तरीय कमेटी | Zee Bihar Ground Report",
        media_type="video",
        language="hi",
        posted_at=now - timedelta(days=2, hours=4),
        first_seen_at=now - timedelta(days=2, hours=4),
        last_checked_at=now,
        link_status="active",
        sentiment_verdict="Negative",
        sentiment_score=-41.0,
        confidence=0.90,
        top_topic="jobs",
        views=295000,
        likes=11200,
        shares=1850,
        comment_count=420,
        negative_comment_count=275,
        positive_comment_count=105,
        neutral_comment_count=40,
        mixed_comment_count=0,
        negative_comment_pct=65.48,
        growth_velocity=22.0,
        alert_flag=False,
        alert_milestone=0,
        matched_keywords=["सीएम सम्राट चौधरी", "Samrat Choudhary"]
    )
    posts_to_create.append(p7)

    # Post 8: Kashish News Bihar (Flood Management Review, Balanced)
    yt_kashish_id = "ebsC0nc48Mo"  # Real Kashish News video
    p8 = Post(
        platform="youtube",
        platform_item_id=yt_kashish_id,
        author_handle="KashishNewsBihar",
        author_name="Kashish News Bihar",
        author_label="news-media",
        permalink_url=build_youtube_video_url(yt_kashish_id),
        canonical_url=build_youtube_video_url(yt_kashish_id),
        text="उत्तर बिहार में बाढ़ राहत कार्यों का सीएम सम्राट चौधरी ने लिया जायजा: प्रभावित जिलों के डीएम को दिए सख्त निर्देश | Kashish News",
        media_type="video",
        language="hi",
        posted_at=now - timedelta(days=3, hours=10),
        first_seen_at=now - timedelta(days=3, hours=10),
        last_checked_at=now,
        link_status="active",
        sentiment_verdict="Neutral",
        sentiment_score=4.5,
        confidence=0.86,
        top_topic="floods",
        views=180000,
        likes=6200,
        shares=920,
        comment_count=135,
        negative_comment_count=52,
        positive_comment_count=65,
        neutral_comment_count=18,
        mixed_comment_count=0,
        negative_comment_pct=38.52,
        growth_velocity=8.2,
        alert_flag=False,
        alert_milestone=0,
        matched_keywords=["सीएम सम्राट चौधरी"]
    )
    posts_to_create.append(p8)

    # Post 9: Live Cities Media (Expressway & Infrastructure, Highly Supportive)
    yt_lc_id = "IppChTHPGo0"  # Real Live Cities Media video
    p9 = Post(
        platform="youtube",
        platform_item_id=yt_lc_id,
        author_handle="LiveCitiesMedia",
        author_name="Live Cities Media",
        author_label="news-media",
        permalink_url=build_youtube_video_url(yt_lc_id),
        canonical_url=build_youtube_video_url(yt_lc_id),
        text="पटना-पूर्णिया एक्सप्रेसवे और नए इंडस्ट्रियल पार्क पर सीएम सम्राट चौधरी का एक्सक्लूसिव विज़न | Live Cities Media Interview",
        media_type="video",
        language="hi",
        posted_at=now - timedelta(days=1, hours=18),
        first_seen_at=now - timedelta(days=1, hours=18),
        last_checked_at=now,
        link_status="active",
        sentiment_verdict="Positive",
        sentiment_score=62.0,
        confidence=0.94,
        top_topic="development",
        views=425000,
        likes=21000,
        shares=3400,
        comment_count=310,
        negative_comment_count=60,
        positive_comment_count=230,
        neutral_comment_count=20,
        mixed_comment_count=0,
        negative_comment_pct=19.35,
        growth_velocity=25.0,
        alert_flag=False,
        alert_milestone=0,
        matched_keywords=["सीएम सम्राट चौधरी", "Samrat Choudhary"]
    )
    posts_to_create.append(p9)

    # Post 10: News4Nation (100 Days Analysis, Critical Editorial Stance)
    yt_n4n_id = "93SHFWzGrRs"  # Real News4Nation video
    p10 = Post(
        platform="youtube",
        platform_item_id=yt_n4n_id,
        author_handle="News4Nation",
        author_name="News4Nation",
        author_label="news-media",
        permalink_url=build_youtube_video_url(yt_n4n_id),
        canonical_url=build_youtube_video_url(yt_n4n_id),
        text="सम्राट चौधरी सरकार के 100 दिन: वादों और हकीकत पर तीखा विश्लेषण, कानून-व्यवस्था और ट्रांसफर-पोस्टिंग पर उठे सवाल | News4Nation",
        media_type="video",
        language="hi",
        posted_at=now - timedelta(days=2, hours=16),
        first_seen_at=now - timedelta(days=2, hours=16),
        last_checked_at=now,
        link_status="active",
        sentiment_verdict="Negative",
        sentiment_score=-63.5,
        confidence=0.93,
        top_topic="corruption",
        views=345000,
        likes=13400,
        shares=2750,
        comment_count=495,
        negative_comment_count=385,
        positive_comment_count=75,
        neutral_comment_count=35,
        mixed_comment_count=0,
        negative_comment_pct=77.78,
        growth_velocity=29.4,
        alert_flag=False,
        alert_milestone=0,
        matched_keywords=["सम्राट चौधरी", "Bihar CM"]
    )
    posts_to_create.append(p10)

    # Post 11: ABP News Bihar (Global Investors Summit, Supportive)
    yt_abp_id = "l3wOL9BDe68"  # Real ABP News video
    p11 = Post(
        platform="youtube",
        platform_item_id=yt_abp_id,
        author_handle="ABPNews",
        author_name="ABP News Bihar",
        author_label="news-media",
        permalink_url=build_youtube_video_url(yt_abp_id),
        canonical_url=build_youtube_video_url(yt_abp_id),
        text="बिहार ग्लोबल इन्वेस्टर्स समिट 2026: सीएम सम्राट चौधरी बोले- निवेशकों को मिलेगी पूरी सुरक्षा और सिंगल विंडो क्लीयरेंस | ABP News",
        media_type="video",
        language="hi",
        posted_at=now - timedelta(hours=20),
        first_seen_at=now - timedelta(hours=20),
        last_checked_at=now,
        link_status="active",
        sentiment_verdict="Positive",
        sentiment_score=38.0,
        confidence=0.91,
        top_topic="jobs",
        views=530000,
        likes=24500,
        shares=4100,
        comment_count=320,
        negative_comment_count=85,
        positive_comment_count=205,
        neutral_comment_count=30,
        mixed_comment_count=0,
        negative_comment_pct=26.56,
        growth_velocity=35.0,
        alert_flag=False,
        alert_milestone=0,
        matched_keywords=["सीएम सम्राट चौधरी", "Samrat Choudhary"]
    )
    posts_to_create.append(p11)

    # Post 12: Prabhat Khabar (Ground Reality Hospital Inspection, Balanced/Neutral)
    yt_pk_id = "1Tdx-Q5qFGY"  # Real Prabhat Khabar video
    p12 = Post(
        platform="youtube",
        platform_item_id=yt_pk_id,
        author_handle="PrabhatKhabarOfficial",
        author_name="Prabhat Khabar",
        author_label="news-media",
        permalink_url=build_youtube_video_url(yt_pk_id),
        canonical_url=build_youtube_video_url(yt_pk_id),
        text="प्रभात खबर पड़ताल: क्या बिहार के सदर अस्पतालों में सुधरी व्यवस्था? सीएम सम्राट चौधरी के औचक दौरों का कितना हुआ असर? | Ground Reality",
        media_type="video",
        language="hi",
        posted_at=now - timedelta(days=4, hours=6),
        first_seen_at=now - timedelta(days=4, hours=6),
        last_checked_at=now,
        link_status="active",
        sentiment_verdict="Neutral",
        sentiment_score=-1.2,
        confidence=0.87,
        top_topic="development",
        views=155000,
        likes=5800,
        shares=810,
        comment_count=115,
        negative_comment_count=49,
        positive_comment_count=46,
        neutral_comment_count=20,
        mixed_comment_count=0,
        negative_comment_pct=42.61,
        growth_velocity=6.5,
        alert_flag=False,
        alert_milestone=0,
        matched_keywords=["सीएम सम्राट चौधरी"]
    )
    posts_to_create.append(p12)

    for p in posts_to_create:
        db.add(p)
    await db.flush()

    # 2. Generate comments for Post 1 (The 501+ Negative Comments alert scenario)
    p1_comments = []
    # Generate 505 negative comments
    for i in range(1, 506):
        c_id = f"c_flood_neg_{i}"
        raw_author = f"yt_user_voter_{i}"
        text = HINDI_NEGATIVE_COMMENTS[i % len(HINDI_NEGATIVE_COMMENTS)] if i % 2 == 0 else HINGLISH_NEGATIVE_COMMENTS[i % len(HINGLISH_NEGATIVE_COMMENTS)]
        topic = "floods" if i % 3 == 0 else ("law & order" if i % 3 == 1 else "corruption")
        p1_comments.append(
            Comment(
                post_id=p1.id,
                platform_comment_id=c_id,
                commenter_hash=hash_commenter_id(raw_author),
                text=text,
                language="hi" if i % 2 == 0 else "en",
                timestamp=p1.posted_at + timedelta(minutes=i * 3),
                like_count=random.randint(1, 240),
                sentiment_label="Negative",
                sentiment_score=-85.0,
                confidence=0.95,
                target_of_sentiment="Samrat Choudhary / Govt",
                topic=topic,
                is_sarcastic=(i % 15 == 0),
                is_abusive=False,
                reason_short="Direct criticism of flood relief administration and governance",
                permalink_url=build_youtube_comment_url(p1.platform_item_id, c_id)
            )
        )

    # 12 positive comments
    for i in range(1, 13):
        c_id = f"c_flood_pos_{i}"
        raw_author = f"yt_user_supporter_{i}"
        text = HINDI_POSITIVE_COMMENTS[i % len(HINDI_POSITIVE_COMMENTS)]
        p1_comments.append(
            Comment(
                post_id=p1.id,
                platform_comment_id=c_id,
                commenter_hash=hash_commenter_id(raw_author),
                text=text,
                language="hi",
                timestamp=p1.posted_at + timedelta(minutes=i * 10),
                like_count=random.randint(5, 50),
                sentiment_label="Positive",
                sentiment_score=75.0,
                confidence=0.90,
                target_of_sentiment="Samrat Choudhary / Govt",
                topic="development",
                is_sarcastic=False,
                is_abusive=False,
                reason_short="Expresses trust in CM's ongoing relief efforts",
                permalink_url=build_youtube_comment_url(p1.platform_item_id, c_id)
            )
        )

    for c in p1_comments:
        db.add(c)

    # Add comments for Post 2 (Pro-CM)
    for i in range(1, 35):
        c_id = f"c_metro_pos_{i}"
        text = HINDI_POSITIVE_COMMENTS[i % len(HINDI_POSITIVE_COMMENTS)]
        db.add(
            Comment(
                post_id=p2.id,
                platform_comment_id=c_id,
                commenter_hash=hash_commenter_id(f"patna_citizen_{i}"),
                text=text,
                language="hi",
                timestamp=p2.posted_at + timedelta(minutes=i * 15),
                like_count=random.randint(10, 150),
                sentiment_label="Positive",
                sentiment_score=90.0,
                confidence=0.96,
                target_of_sentiment="Samrat Choudhary / Govt",
                topic="development",
                permalink_url=build_youtube_comment_url(p2.platform_item_id, c_id)
            )
        )

    # Comments for News Channel Posts (p6 to p12)
    # Post 6 (News18 Bihar - Law & Order)
    for i in range(1, 16):
        c_id = f"c_n18_pos_{i}"
        text = "पुलिस अब अपराधियों पर सख्त कार्रवाई कर रही है, कानून का राज दिखना चाहिए।" if i % 2 == 0 else "सम्राट चौधरी जी का कड़ा रुख जरूरी था, जनता उनके साथ है।"
        db.add(Comment(
            post_id=p6.id,
            platform_comment_id=c_id,
            commenter_hash=hash_commenter_id(f"n18_viewer_{i}"),
            text=text,
            language="hi",
            timestamp=p6.posted_at + timedelta(minutes=i * 12),
            like_count=random.randint(15, 95),
            sentiment_label="Positive",
            sentiment_score=78.0,
            confidence=0.92,
            target_of_sentiment="Samrat Choudhary / Govt",
            topic="law & order",
            permalink_url=build_youtube_comment_url(p6.platform_item_id, c_id)
        ))
    for i in range(1, 6):
        c_id = f"c_n18_neg_{i}"
        text = "सिर्फ बयानबाजी से अपराध नहीं रुकेगा, थानों में घूसखोरी बंद होनी चाहिए।"
        db.add(Comment(
            post_id=p6.id,
            platform_comment_id=c_id,
            commenter_hash=hash_commenter_id(f"n18_crit_{i}"),
            text=text,
            language="hi",
            timestamp=p6.posted_at + timedelta(minutes=i * 20),
            like_count=random.randint(10, 50),
            sentiment_label="Negative",
            sentiment_score=-65.0,
            confidence=0.88,
            target_of_sentiment="Samrat Choudhary / Govt",
            topic="law & order",
            permalink_url=build_youtube_comment_url(p6.platform_item_id, c_id)
        ))

    # Post 7 (Zee Bihar Jharkhand - Jobs / BPSC Protest)
    for i in range(1, 19):
        c_id = f"c_zee_neg_{i}"
        text = "BPSC के छात्र कब तक लाठी खाएंगे? सरकार युवाओं के भविष्य के साथ खिलवाड़ बंद करे!" if i % 2 == 0 else "Exam me dhandhli aur paper leak par CM Samrat Choudhary jawab de."
        db.add(Comment(
            post_id=p7.id,
            platform_comment_id=c_id,
            commenter_hash=hash_commenter_id(f"zee_aspirant_{i}"),
            text=text,
            language="hi" if i % 2 == 0 else "en",
            timestamp=p7.posted_at + timedelta(minutes=i * 8),
            like_count=random.randint(25, 180),
            sentiment_label="Negative",
            sentiment_score=-82.0,
            confidence=0.94,
            target_of_sentiment="Samrat Choudhary / Govt",
            topic="jobs",
            permalink_url=build_youtube_comment_url(p7.platform_item_id, c_id)
        ))

    # Post 9 (Live Cities Media - Expressway / Development)
    for i in range(1, 19):
        c_id = f"c_lc_pos_{i}"
        text = "पटना-पूर्णिया एक्सप्रेसवे से उत्तर बिहार और सीमांचल का कायाकल्प हो जाएगा।" if i % 2 == 0 else "Great infrastructure vision by CM Samrat Choudhary. Bihar needs roads and industrial parks."
        db.add(Comment(
            post_id=p9.id,
            platform_comment_id=c_id,
            commenter_hash=hash_commenter_id(f"lc_supporter_{i}"),
            text=text,
            language="hi" if i % 2 == 0 else "en",
            timestamp=p9.posted_at + timedelta(minutes=i * 10),
            like_count=random.randint(20, 140),
            sentiment_label="Positive",
            sentiment_score=85.0,
            confidence=0.95,
            target_of_sentiment="Samrat Choudhary / Govt",
            topic="development",
            permalink_url=build_youtube_comment_url(p9.platform_item_id, c_id)
        ))

    # Post 10 (News4Nation - Critical 100 Days)
    for i in range(1, 21):
        c_id = f"c_n4n_neg_{i}"
        text = "100 दिन में कोई ठोस काम नहीं हुआ, जनता ठगी महसूस कर रही है।" if i % 2 == 0 else "Transfer-posting syndicate is active again, zero accountability."
        db.add(Comment(
            post_id=p10.id,
            platform_comment_id=c_id,
            commenter_hash=hash_commenter_id(f"n4n_user_{i}"),
            text=text,
            language="hi" if i % 2 == 0 else "en",
            timestamp=p10.posted_at + timedelta(minutes=i * 7),
            like_count=random.randint(30, 190),
            sentiment_label="Negative",
            sentiment_score=-80.0,
            confidence=0.93,
            target_of_sentiment="Samrat Choudhary / Govt",
            topic="corruption",
            permalink_url=build_youtube_comment_url(p10.platform_item_id, c_id)
        ))

    # Post 11 (ABP News - Investors Summit)
    for i in range(1, 16):
        c_id = f"c_abp_pos_{i}"
        text = "उद्योग लगेंगे तो बिहार के युवाओं को पलायन नहीं करना पड़ेगा, ऐतिहासिक पहल।" if i % 2 == 0 else "Decisive leadership on ease of doing business in Bihar."
        db.add(Comment(
            post_id=p11.id,
            platform_comment_id=c_id,
            commenter_hash=hash_commenter_id(f"abp_viewer_{i}"),
            text=text,
            language="hi" if i % 2 == 0 else "en",
            timestamp=p11.posted_at + timedelta(minutes=i * 11),
            like_count=random.randint(18, 110),
            sentiment_label="Positive",
            sentiment_score=76.0,
            confidence=0.90,
            target_of_sentiment="Samrat Choudhary / Govt",
            topic="jobs",
            permalink_url=build_youtube_comment_url(p11.platform_item_id, c_id)
        ))

    # Add Critical Alert record for Post 1 crossing 500 negative comments
    alert1 = Alert(
        post_id=p1.id,
        alert_type="critical_500",
        severity="critical",
        milestone_value=500,
        title="CRITICAL: Negative comment threshold (500+) crossed",
        message="Post 'बिहार में बाढ़ राहत सामग्री वितरण...' has received 505 negative comments (96.2% negative).",
        negative_comment_count=505,
        negative_pct=96.19,
        growth_rate=42.5,
        top_topics_json=["floods", "corruption", "law & order"],
        top_negative_comments_json=[
            {
                "text": HINDI_NEGATIVE_COMMENTS[0],
                "permalink": build_youtube_comment_url(p1.platform_item_id, "c_flood_neg_1"),
                "like_count": 235
            },
            {
                "text": HINGLISH_NEGATIVE_COMMENTS[0],
                "permalink": build_youtube_comment_url(p1.platform_item_id, "c_flood_neg_2"),
                "like_count": 184
            },
            {
                "text": HINDI_NEGATIVE_COMMENTS[3],
                "permalink": build_youtube_comment_url(p1.platform_item_id, "c_flood_neg_3"),
                "like_count": 162
            },
            {
                "text": HINGLISH_NEGATIVE_COMMENTS[3],
                "permalink": build_youtube_comment_url(p1.platform_item_id, "c_flood_neg_4"),
                "like_count": 141
            },
            {
                "text": HINDI_NEGATIVE_COMMENTS[5],
                "permalink": build_youtube_comment_url(p1.platform_item_id, "c_flood_neg_5"),
                "like_count": 128
            }
        ],
        status="active",
        triggered_at=now - timedelta(hours=4)
    )
    db.add(alert1)

    # Add historical metric snapshots for post 1
    for h in range(1, 10):
        db.add(
            MetricSnapshot(
                post_id=p1.id,
                snapshot_at=p1.posted_at + timedelta(hours=h * 3),
                views=45000 * h,
                likes=800 * h,
                shares=140 * h,
                comments=55 * h,
                negative_comments=50 * h,
                velocity=30.0 + (h * 1.5)
            )
        )

    await db.commit()
    logger.info("Database seeding completed successfully.")
