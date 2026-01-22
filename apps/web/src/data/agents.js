export const agents = [
    {
        id: 'pam',
        name: 'Pam',
        role: 'Receptionist',
        gradient: 'linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%)',
        avatar: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Jessica&backgroundColor=b6e3f4',
        desc: 'Welcomes visitors, schedules appointments, and routes calls effectively.',
        integrations: ['Google Calendar', 'Gmail', 'Slack', 'Twilio'],
        capabilities: [
            'Connect to your Google Calendar to auto-schedule meetings with leads',
            'Answer calls via Twilio and route to the right team member',
            'Send automated follow-up emails through your Gmail account',
            'Post welcome messages and updates to your Slack channels',
            'Qualify leads with custom questions before booking appointments'
        ]
    },
    {
        id: 'penn',
        name: 'Penn',
        role: 'Copywriter',
        gradient: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
        avatar: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Robert&backgroundColor=ffdfbf',
        desc: 'Writes high-converting copy for ads, emails, and landing pages.',
        integrations: ['Google Ads', 'Meta Ads', 'Mailchimp', 'Notion'],
        capabilities: [
            'Create and publish ad copy directly to Google Ads & Meta Ads',
            'Draft and schedule email campaigns in Mailchimp automatically',
            'Generate landing page content and push to your CMS',
            'Store all copy versions in Notion for team review',
            'A/B test variations and auto-optimize based on performance data'
        ]
    },
    {
        id: 'cassie',
        name: 'Cassie',
        role: 'Support Agent',
        gradient: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
        avatar: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Emily&backgroundColor=ffdfbf',
        desc: 'Handles customer inquiries and support tickets 24/7.',
        integrations: ['Zendesk', 'Intercom', 'Gmail', 'Slack'],
        capabilities: [
            'Respond to tickets in Zendesk and Intercom automatically',
            'Send personalized email responses via your Gmail account',
            'Escalate complex issues to your team on Slack in real-time',
            'Update CRM records with conversation summaries',
            'Generate knowledge base articles from resolved tickets'
        ]
    },
    {
        id: 'dexter',
        name: 'Dexter',
        role: 'Data Analyst',
        gradient: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
        avatar: 'https://api.dicebear.com/7.x/lorelei/svg?seed=David&backgroundColor=d1d4f9',
        desc: 'Visualizes data and uncovers hidden business insights.',
        integrations: ['Google Sheets', 'Google Analytics', 'Stripe', 'Slack'],
        capabilities: [
            'Pull live data from Google Analytics, Stripe, and your databases',
            'Auto-generate weekly/monthly reports in Google Sheets',
            'Send performance alerts and summaries to Slack',
            'Create interactive dashboards with real-time metrics',
            'Forecast revenue and identify trends automatically'
        ]
    },
    {
        id: 'soshie',
        name: 'Soshie',
        role: 'Social Manager',
        gradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
        avatar: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Jennifer&backgroundColor=d1d4f9',
        desc: 'Plans and creates engaging content for social media.',
        integrations: ['Instagram', 'Facebook', 'LinkedIn', 'X (Twitter)', 'Buffer'],
        capabilities: [
            'Auto-post content to Instagram, Facebook, LinkedIn & X',
            'Schedule posts across all platforms via Buffer integration',
            'Monitor brand mentions and reply to comments automatically',
            'Generate content calendars based on trending topics',
            'Analyze engagement and auto-optimize posting times'
        ]
    }
];
