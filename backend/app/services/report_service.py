import io
from datetime import datetime
from typing import Dict, Any, List
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.post import Post

async def get_news_channel_report(db: AsyncSession) -> Dict[str, Any]:
    """
    Compiles intelligence on news channels covering CM Samrat Choudhary:
    - Per-channel metrics: reach, negative feedback %, stance score, stance label, top stories
    - Overall media landscape metrics
    """
    result = await db.execute(
        select(Post).where(Post.author_label == "news-media").order_by(desc(Post.posted_at))
    )
    posts = result.scalars().all()

    channel_groups: Dict[str, List[Post]] = {}
    for p in posts:
        key = f"{p.platform}_{p.author_handle}"
        if key not in channel_groups:
            channel_groups[key] = []
        channel_groups[key].append(p)

    channels_data = []
    total_reach = 0
    total_stories = 0
    total_neg_comments = 0
    total_comments = 0
    stance_scores = []

    for key, ch_posts in channel_groups.items():
        first = ch_posts[0]
        c_views = sum(p.views for p in ch_posts)
        c_comments = sum(p.comment_count for p in ch_posts)
        c_neg_comments = sum(p.negative_comment_count for p in ch_posts)
        c_pos_comments = sum(p.positive_comment_count for p in ch_posts)
        c_neu_comments = sum(p.neutral_comment_count for p in ch_posts)
        c_score = sum(p.sentiment_score for p in ch_posts) / len(ch_posts)

        top_viewed = max(ch_posts, key=lambda x: x.views)
        most_critical = max(ch_posts, key=lambda x: x.negative_comment_count)

        neg_pct = (c_neg_comments / c_comments * 100) if c_comments > 0 else 0.0

        if c_score > 15:
            stance_label = "Supportive"
            stance_color = "emerald"
        elif c_score < -15:
            stance_label = "Critical"
            stance_color = "rose"
        else:
            stance_label = "Neutral / Balanced"
            stance_color = "slate"

        topics = list({p.top_topic for p in ch_posts if p.top_topic})

        total_reach += c_views
        total_stories += len(ch_posts)
        total_neg_comments += c_neg_comments
        total_comments += c_comments
        stance_scores.append(c_score)

        channels_data.append({
            "name": first.author_name,
            "handle": first.author_handle,
            "platform": first.platform,
            "label": first.author_label,
            "total_stories": len(ch_posts),
            "total_reach": c_views,
            "total_comments": c_comments,
            "negative_comments": c_neg_comments,
            "positive_comments": c_pos_comments,
            "neutral_comments": c_neu_comments,
            "negative_comment_pct": round(neg_pct, 2),
            "stance_score": round(c_score, 1),
            "stance_label": stance_label,
            "stance_color": stance_color,
            "top_story": {
                "title": top_viewed.text,
                "views": top_viewed.views,
                "sentiment": top_viewed.sentiment_verdict,
                "permalink": top_viewed.permalink_url
            },
            "most_critical_story": {
                "title": most_critical.text,
                "negative_comments": most_critical.negative_comment_count,
                "permalink": most_critical.permalink_url
            },
            "topics": topics
        })

    channels_data.sort(key=lambda x: x["total_reach"], reverse=True)

    avg_overall_stance = sum(stance_scores) / len(stance_scores) if stance_scores else 0.0
    overall_sentiment_label = (
        "Moderately Supportive" if avg_overall_stance > 15 else
        "Critical Leaning" if avg_overall_stance < -15 else
        "Neutral / Balanced"
    )

    most_critical_ch = min(channels_data, key=lambda x: x["stance_score"]) if channels_data else None
    most_supportive_ch = max(channels_data, key=lambda x: x["stance_score"]) if channels_data else None

    return {
        "summary": {
            "total_news_outlets": len(channels_data),
            "total_news_stories": total_stories,
            "total_news_reach": total_reach,
            "total_news_comments": total_comments,
            "total_negative_comments": total_neg_comments,
            "negative_comment_pct": round((total_neg_comments / total_comments * 100), 2) if total_comments > 0 else 0.0,
            "avg_media_stance_score": round(avg_overall_stance, 1),
            "overall_media_sentiment": overall_sentiment_label,
            "most_critical_outlet": most_critical_ch["name"] if most_critical_ch else None,
            "most_supportive_outlet": most_supportive_ch["name"] if most_supportive_ch else None
        },
        "channels": channels_data
    }

async def generate_executive_pdf_report(db: AsyncSession) -> bytes:
    """
    Generates an executive PDF intelligence report containing:
    - Overview & News Media Editorial Stance Report
    - Top 20 Most Negative Posts with direct clickable links
    - Top 20 Most Positive Posts with direct clickable links
    - Top 20 Neutral Posts with direct clickable links
    """
    # Fetch news channel intelligence
    news_report = await get_news_channel_report(db)

    # Fetch top posts
    neg_res = await db.execute(select(Post).where(Post.sentiment_verdict == "Negative").order_by(desc(Post.negative_comment_count)).limit(20))
    top_negative = neg_res.scalars().all()

    pos_res = await db.execute(select(Post).where(Post.sentiment_verdict == "Positive").order_by(desc(Post.positive_comment_count)).limit(20))
    top_positive = pos_res.scalars().all()

    neu_res = await db.execute(select(Post).where(Post.sentiment_verdict == "Neutral").order_by(desc(Post.comment_count)).limit(20))
    top_neutral = neu_res.scalars().all()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'ReportTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=12
    )
    section_style = ParagraphStyle(
        'ReportSection',
        parent=styles['Heading2'],
        fontSize=13,
        leading=17,
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=12,
        spaceAfter=6
    )
    subtext_style = ParagraphStyle(
        'ReportSubtext',
        parent=styles['Normal'],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#64748b'),
        spaceAfter=8
    )
    cell_style = ParagraphStyle(
        'CellText',
        parent=styles['Normal'],
        fontSize=7.5,
        leading=9.5
    )
    link_style = ParagraphStyle(
        'LinkText',
        parent=styles['Normal'],
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#2563eb')
    )

    story = []

    # Title & Metadata
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
    story.append(Paragraph("Bihar CM Samrat Choudhary - Social Media Watchtower", title_style))
    story.append(Paragraph(f"Executive Intelligence & News Media Analysis Report | Generated: {now_str}", styles['Normal']))
    story.append(Spacer(1, 10))

    # SECTION 1: News Media Editorial Stance & Sentiment Report
    story.append(Paragraph("News Media Channels Coverage & Editorial Stance (समाचार चैनल रिपोर्ट)", section_style))
    story.append(Paragraph(
        f"Monitored Outlets: {news_report['summary']['total_news_outlets']} | "
        f"Total Audience Reach: {news_report['summary']['total_news_reach']:,} | "
        f"Overall Stance Index: {news_report['summary']['avg_media_stance_score']:+.1f} ({news_report['summary']['overall_media_sentiment']})",
        subtext_style
    ))

    news_headers = ["News Channel", "Platform", "Stories", "Audience Reach", "Neg Comment %", "CM Stance", "Editorial Verdict", "Broadcast Link"]
    news_table_data = [[Paragraph(f"<b>{h}</b>", cell_style) for h in news_headers]]

    for ch in news_report["channels"]:
        score_txt = f"{ch['stance_score']:+.1f}"
        link_html = f'<a href="{ch["top_story"]["permalink"]}"><font color="#2563eb"><u>Watch Broadcast</u></font></a>'
        news_table_data.append([
            Paragraph(ch["name"][:20], cell_style),
            Paragraph(ch["platform"].upper(), cell_style),
            Paragraph(str(ch["total_stories"]), cell_style),
            Paragraph(f"{ch['total_reach']:,}", cell_style),
            Paragraph(f"{ch['negative_comment_pct']:.1f}%", cell_style),
            Paragraph(score_txt, cell_style),
            Paragraph(ch["stance_label"], cell_style),
            Paragraph(link_html, link_style)
        ])

    if news_report["channels"]:
        t_news = Table(news_table_data, colWidths=[110, 50, 45, 75, 65, 55, 80, 60])
        t_news.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0284c7')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(t_news)
    else:
        story.append(Paragraph("No news media posts currently tracked.", styles['Normal']))

    story.append(Spacer(1, 14))

    def make_table(posts: List[Post], header_bg: colors.Color):
        headers = ["Platform", "Source", "Summary", "Topic", "Reach", "Neg Comments", "Direct Link"]
        data = [[Paragraph(f"<b>{h}</b>", cell_style) for h in headers]]
        for p in posts:
            clean_text = p.text.replace("\n", " ")[:60] + "..."
            link_html = f'<a href="{p.permalink_url}"><font color="#2563eb"><u>Open Link</u></font></a>'
            data.append([
                Paragraph(p.platform.upper(), cell_style),
                Paragraph(p.author_name[:18], cell_style),
                Paragraph(clean_text, cell_style),
                Paragraph(p.top_topic, cell_style),
                Paragraph(str(p.views), cell_style),
                Paragraph(f"{p.negative_comment_count} ({p.negative_comment_pct:.1f}%)", cell_style),
                Paragraph(link_html, link_style)
            ])
        t = Table(data, colWidths=[55, 85, 185, 65, 45, 65, 45])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), header_bg),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        return t

    # 2. Top Negative Section
    story.append(Paragraph("Top Critical Negative Posts (Needs Attention)", section_style))
    if top_negative:
        story.append(make_table(top_negative, colors.HexColor('#e11d48')))
    else:
        story.append(Paragraph("No negative posts tracked.", styles['Normal']))
    story.append(Spacer(1, 14))
    story.append(PageBreak())

    # 3. Top Positive Section
    story.append(Paragraph("Top Supportive / Pro-CM Posts", section_style))
    if top_positive:
        story.append(make_table(top_positive, colors.HexColor('#059669')))
    else:
        story.append(Paragraph("No positive posts tracked.", styles['Normal']))
    story.append(Spacer(1, 14))
    story.append(PageBreak())

    # 4. Top Neutral Section
    story.append(Paragraph("Top Neutral Informational Posts", section_style))
    if top_neutral:
        story.append(make_table(top_neutral, colors.HexColor('#475569')))
    else:
        story.append(Paragraph("No neutral posts tracked.", styles['Normal']))

    doc.build(story)
    return buffer.getvalue()
