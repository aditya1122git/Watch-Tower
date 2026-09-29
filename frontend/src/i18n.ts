export type Language = 'en' | 'hi';

export const translations = {
  en: {
    appTitle: "Social Media Watchtower",
    subTitle: "CM Samrat Choudhary Public Sentiment & Crisis Early Warning",
    liveStatus: "Live Feed",
    connected: "Connected",
    disconnected: "Reconnecting",
    tabs: {
      overview: "Overview Dashboard",
      timeline: "Live Timeline (Hourly/Min)",
      links: "Links Explorer",
      alerts: "Alerts Center",
      channels: "Channels & News Media",
      topics: "Topic Heatmap",
      import: "Data Ingestion"
    },
    metrics: {
      overallSentiment: "Overall CM Stance",
      totalPosts: "Tracked Posts",
      totalComments: "Tracked Comments",
      activeAlerts: "Active Alerts",
      negativeRatio: "Negative Reaction Ratio",
      reach: "Reach / Views",
      engagement: "Engagement"
    },
    linksTabs: {
      all: "All Posts",
      positive: "Positive (Pro-CM)",
      negative: "Negative (Criticism)",
      neutral: "Neutral",
      mixed: "Mixed",
      needsReview: "Needs Review",
      alerted: "Alerted (500+ Neg)"
    },
    actions: {
      openOriginal: "Open Original",
      copyLink: "Copy Link",
      exportCsv: "Export Filtered CSV",
      downloadPdf: "Download PDF Report",
      seedData: "Reload Demo Dataset",
      acknowledge: "Acknowledge",
      resolve: "Resolve",
      viewDetails: "View Drill-down",
      uploadFile: "Upload CSV / JSON"
    },
    table: {
      platform: "Platform",
      author: "Page / Channel",
      content: "Content Snippet",
      topic: "Top Topic",
      sentiment: "Sentiment",
      comments: "Comments",
      negComments: "Neg Comments (%)",
      status: "Link Health",
      actions: "Actions"
    },
    linkHealth: {
      active: "Active",
      unavailable: "Unavailable",
      deleted: "Deleted",
      private: "Private"
    },
    newsMedia: {
      title: "News Media & Channel Intelligence",
      subTitle: "Editorial stance, reach, and sentiment breakdown across major Bihar news channels",
      allChannels: "All Accounts",
      newsMediaOnly: "News Media Channels (समाचार चैनल)",
      outletsCount: "Monitored Outlets",
      mediaReach: "Total Broadcast Reach",
      stanceIndex: "Overall Media Stance",
      mostSupportive: "Most Supportive Outlet",
      mostCritical: "Most Critical Outlet",
      stanceSupportive: "Supportive",
      stanceCritical: "Critical",
      stanceBalanced: "Neutral / Balanced",
      viewBroadcast: "Watch Broadcast",
      negativeFeedback: "Negative Audience Reaction",
      stories: "Stories Covered"
    },
    formats: {
      all: "All Formats",
      reel: "🎬 Reels (Insta/FB)",
      short: "⚡ Shorts (YouTube)",
      news_bulletin: "📺 News Bulletins",
      video: "📹 Videos",
      article: "📰 News Articles",
      tweet: "🐦 Tweets / Posts"
    },
    stances: {
      all: "All Stances",
      supporter: "🟢 Supporter / Pro-Govt",
      opposition: "🔴 Opposition / Critic",
      newsMedia: "📺 News Media",
      neutral: "⚪ Neutral"
    },
    focusNegative: "🔥 High-Risk Negative Focus",
    focusNegativeDesc: "Prioritizing critical reels, shorts, news bulletins & attack posts"
  },
  hi: {
    appTitle: "सोशल मीडिया वॉचटावर",
    subTitle: "मुख्यमंत्री सम्राट चौधरी जनमत निगरानी एवं त्वरित चेतावनी प्रणाली",
    liveStatus: "लाइव फीड",
    connected: "सक्रिय जुड़ाव",
    disconnected: "पुनः जुड़ रहा है",
    tabs: {
      overview: "सिंहावलोकन डैशबोर्ड",
      timeline: "लाइव टाइमलाइन (घंटा/मिनट)",
      links: "लिंक्स एक्सप्लोरर",
      alerts: "अलर्ट केंद्र",
      channels: "चैनल एवं न्यूज़ मीडिया रिपोर्ट",
      topics: "मुद्दा विश्लेषण",
      import: "डेटा आयात"
    },
    metrics: {
      overallSentiment: "समग्र सीएम दृष्टिकोण",
      totalPosts: "कुल ट्रैक की गई पोस्ट",
      totalComments: "कुल ट्रैक की गई टिप्पणियां",
      activeAlerts: "सक्रिय अलर्ट",
      negativeRatio: "नकारात्मक प्रतिक्रिया अनुपात",
      reach: "पहुंच / व्यूज",
      engagement: "जुड़ाव"
    },
    linksTabs: {
      all: "सभी पोस्ट",
      positive: "सकारात्मक (सीएम समर्थक)",
      negative: "नकारात्मक (आलोचना)",
      neutral: "तटस्थ",
      mixed: "मिश्रित",
      needsReview: "समीक्षा आवश्यक",
      alerted: "अलर्टेड (500+ नकारात्मक)"
    },
    actions: {
      openOriginal: "मूल लिंक खोलें",
      copyLink: "लिंक कॉपी करें",
      exportCsv: "फ़िल्टर किया CSV डाउनलोड करें",
      downloadPdf: "पीडीएफ रिपोर्ट डाउनलोड करें",
      seedData: "डेमो डेटा रीलोड करें",
      acknowledge: "स्वीकार करें",
      resolve: "हल करें",
      viewDetails: "विस्तार से देखें",
      uploadFile: "CSV / JSON अपलोड करें"
    },
    table: {
      platform: "प्लेटफ़ॉर्म",
      author: "पेज / चैनल",
      content: "सामग्री का अंश",
      topic: "शीर्ष मुद्दा",
      sentiment: "दृष्टिकोण",
      comments: "टिप्पणियां",
      negComments: "नकारात्मक टिप्पणियां (%)",
      status: "लिंक स्थिति",
      actions: "कार्रवाई"
    },
    linkHealth: {
      active: "सक्रिय",
      unavailable: "अनुपलब्ध",
      deleted: "हटाया गया",
      private: "निजी"
    },
    newsMedia: {
      title: "समाचार चैनल विश्लेषण एवं रिपोर्ट",
      subTitle: "बिहार के प्रमुख समाचार चैनलों का संपादकीय रुख, दर्शक पहुंच एवं जनमत विश्लेषण",
      allChannels: "सभी खाते",
      newsMediaOnly: "समाचार चैनल (न्यूज़ मीडिया)",
      outletsCount: "कुल ट्रैक किए गए चैनल",
      mediaReach: "कुल प्रसारण पहुंच",
      stanceIndex: "समग्र मीडिया दृष्टिकोण",
      mostSupportive: "सर्वाधिक समर्थक चैनल",
      mostCritical: "सर्वाधिक आलोचक चैनल",
      stanceSupportive: "समर्थक रुख",
      stanceCritical: "आलोचनात्मक रुख",
      stanceBalanced: "तटस्थ / संतुलित",
      viewBroadcast: "मूल प्रसारण देखें",
      negativeFeedback: "जनता की नकारात्मक प्रतिक्रिया",
      stories: "कवर की गई खबरें"
    },
    formats: {
      all: "सभी प्रारूप",
      reel: "🎬 रील (Insta/FB)",
      short: "⚡ शॉर्ट्स (YouTube)",
      news_bulletin: "📺 न्यूज़ बुलेटिन / टीवी",
      video: "📹 वीडियो",
      article: "📰 समाचार लेख / अख़बार",
      tweet: "🐦 ट्वीट्स / पोस्ट"
    },
    stances: {
      all: "सभी दृष्टिकोण",
      supporter: "🟢 पक्ष / समर्थक (सम्राट चौधरी/NDA)",
      opposition: "🔴 विपक्ष / आलोचक (RJD/विपक्ष)",
      newsMedia: "📺 समाचार चैनल / मीडिया",
      neutral: "⚪ तटस्थ"
    },
    focusNegative: "🔥 नकारात्मक पर विशेष ध्यान (High-Risk Focus)",
    focusNegativeDesc: "गंभीर विवाद, विपक्ष के हमले, रील, शॉर्ट्स एवं बुलेटिन को प्राथमिकता"
  }
};
