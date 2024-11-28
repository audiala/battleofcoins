<div align="center">
  <img src="/public/logo.png" alt="Battle of Coins Logo" width="200"/>
  <h1>Battle of Coins</h1>
  <p>AI-Powered Cryptocurrency Tournament Platform</p>
</div>

## 🎮 Overview

Battle of Coins is an interactive platform where cryptocurrencies compete in tournament-style battles. Each battle is judged by AI models based on user-defined criteria, creating engaging and unique crypto competitions.

## 🌟 Key Features

- **AI Tournament System**: Cryptocurrencies compete in bracket-style tournaments
- **Multiple AI Models**: Different AI perspectives evaluate each match
- **Custom Criteria**: Define your own selection criteria for battles
- **Public & Private Battles**: Save battles locally or share them publicly
- **Battle Summaries**: AI-generated summaries of battle outcomes
- **Pay-per-use**: Integrated Nano cryptocurrency payments
- **Responsive Design**: Works seamlessly on all devices

## 🛠️ Tech Stack

- **Frontend**: Astro, React, TypeScript
- **Database**: Supabase
- **Local Storage**: IndexedDB
- **Image Storage**: Cloudflare R2
- **Payments**: Nano cryptocurrency
- **AI**: Multiple LLM models

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Cloudflare R2 account
- Nano wallet

### Installation

1. Clone the repository:
```bash
git clone https://github.com/audiala/battle-of-coins.git
cd battle-of-coins
```
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file with:
```bash
PUBLIC_SUPABASE_URL=your_supabase_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=your_r2_public_url
```
4. Start the development server:
```bash
npx astro dev
```


## 💡 Usage

0. **Set you nano-gpt.com API key in settings**
1. **Select Cryptocurrencies**: Choose from the top 100 cryptocurrencies or filter by category
2. **Define Criteria**: Set your selection criteria for the AI to evaluate
3. **Choose Models**: Select one or more AI models to judge the battles
4. **Start Battle**: Watch as cryptocurrencies compete in tournament rounds
5. **View Results**: See winners, summaries, and share your battles

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. Fork the repository
2. Create a feature branch:
```bash
git checkout -b feature/amazing-feature
```

3. Make your changes 
4. Commit your changes:
```bash
git commit -m 'Add amazing feature'
```
5. Push your changes:
```bash
git push origin feature/amazing-feature
```

6. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Maintain consistent styling
- Add comments for complex logic
- Update tests when modifying functionality
- Keep commits focused and descriptive

## ⚠️ Disclaimer

This platform is for entertainment purposes only. Nothing presented constitutes financial advice. Cryptocurrency investments are highly speculative and risky. Always do your own research (DYOR) and consult with qualified financial advisors before making any investment decisions.

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Thanks to all contributors
- NanoGPT for the amazing LLM integration with Nano
- Nano community for payment solutions
- Supabase team for the backend infrastructure
- Cloudflare for R2 storage solutions

---

<div align="center">
  Made with ❤️ by the Battle of Coins team
</div>