export interface Token {
  id: string;
  name: string;
  ticker: string;
  logo: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  holders: number;
  hypeScore: number;
  bondingProgress: number;
  category: string;
  creatorId: string;
  creatorName: string;
  lore: string;
  launchedAt: string;
  arenaRank: number;
  status: 'fighting' | 'mooning' | 'new' | 'hot' | 'graduated';
}

export interface Creator {
  id: string;
  name: string;
  avatar: string;
  reputation: number;
  launches: number;
  wins: number;
  graduated: number;
  totalHolders: number;
  badges: string[];
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  reward: string;
  icon: string;
}

export interface Activity {
  id: string;
  type: 'buy' | 'sell' | 'holder' | 'mission';
  user: string;
  amount?: number;
  message: string;
  timestamp: string;
}

const emojis = ['🐸', '🦊', '🐶', '🦍', '🐱', '🦁', '🐉', '🤖', '👽', '🎃', '🌶️', '🍕'];

export const mockTokens: Token[] = [
  { id: '1', name: 'PepeFighter', ticker: 'PEPEF', logo: '🐸', price: 0.00042, priceChange24h: 156.7, marketCap: 420000, volume24h: 89000, holders: 1247, hypeScore: 92, bondingProgress: 78, category: 'Animal', creatorId: '1', creatorName: 'DegenKing', lore: 'Born from the sacred pond of memes, PepeFighter enters the arena with legendary frog power.', launchedAt: '2h ago', arenaRank: 1, status: 'mooning' },
  { id: '2', name: 'DogeSlayer', ticker: 'DSLYR', logo: '🐶', price: 0.00018, priceChange24h: 89.3, marketCap: 180000, volume24h: 45000, holders: 834, hypeScore: 85, bondingProgress: 62, category: 'Animal', creatorId: '2', creatorName: 'MemeWizard', lore: 'The ultimate doge variant, forged in the fires of the mempool.', launchedAt: '4h ago', arenaRank: 2, status: 'hot' },
  { id: '3', name: 'ChaosMonkey', ticker: 'CHAOS', logo: '🦍', price: 0.00007, priceChange24h: -12.4, marketCap: 70000, volume24h: 23000, holders: 456, hypeScore: 67, bondingProgress: 35, category: 'Chaos', creatorId: '3', creatorName: 'ApeArmy', lore: 'Pure chaos energy. No roadmap. No plan. Only monkey.', launchedAt: '6h ago', arenaRank: 3, status: 'fighting' },
  { id: '4', name: 'AIOverlord', ticker: 'AILORD', logo: '🤖', price: 0.00031, priceChange24h: 234.1, marketCap: 310000, volume24h: 67000, holders: 1089, hypeScore: 88, bondingProgress: 71, category: 'AI', creatorId: '1', creatorName: 'DegenKing', lore: 'The machines are rising. First they take the blockchain, then the world.', launchedAt: '1h ago', arenaRank: 4, status: 'mooning' },
  { id: '5', name: 'PizzaCoin', ticker: 'PIZZA', logo: '🍕', price: 0.00002, priceChange24h: 45.6, marketCap: 20000, volume24h: 8000, holders: 234, hypeScore: 54, bondingProgress: 18, category: 'Degen', creatorId: '4', creatorName: 'SliceGod', lore: '10,000 BTC was once spent on pizza. Never forget.', launchedAt: '12h ago', arenaRank: 5, status: 'new' },
  { id: '6', name: 'GhostPepe', ticker: 'GHOST', logo: '👽', price: 0.00055, priceChange24h: 312.8, marketCap: 550000, volume24h: 120000, holders: 2100, hypeScore: 96, bondingProgress: 89, category: 'Degen', creatorId: '2', creatorName: 'MemeWizard', lore: 'You can\'t kill what was never alive. GhostPepe haunts the blockchain.', launchedAt: '30m ago', arenaRank: 6, status: 'mooning' },
  { id: '7', name: 'DragonDegen', ticker: 'DRGN', logo: '🐉', price: 0.00012, priceChange24h: -5.2, marketCap: 120000, volume24h: 34000, holders: 567, hypeScore: 72, bondingProgress: 45, category: 'Animal', creatorId: '3', creatorName: 'ApeArmy', lore: 'Fire-breathing tokenomics. Burns on every transaction.', launchedAt: '8h ago', arenaRank: 7, status: 'fighting' },
  { id: '8', name: 'PumpkinPump', ticker: 'PUMP', logo: '🎃', price: 0.00009, priceChange24h: 67.3, marketCap: 90000, volume24h: 28000, holders: 389, hypeScore: 63, bondingProgress: 32, category: 'Chaos', creatorId: '5', creatorName: 'SpookyDev', lore: 'It\'s always spooky season in the arena.', launchedAt: '5h ago', arenaRank: 8, status: 'hot' },
];

export const mockCreators: Creator[] = [
  { id: '1', name: 'DegenKing', avatar: '👑', reputation: 95, launches: 12, wins: 5, graduated: 3, totalHolders: 8900, badges: ['Top Creator', 'Arena Champion', 'Diamond Hands'] },
  { id: '2', name: 'MemeWizard', avatar: '🧙', reputation: 88, launches: 8, wins: 3, graduated: 2, totalHolders: 5600, badges: ['Meme Lord', 'Hype Master'] },
  { id: '3', name: 'ApeArmy', avatar: '🦧', reputation: 72, launches: 15, wins: 2, graduated: 1, totalHolders: 3400, badges: ['Volume King', 'Degen OG'] },
  { id: '4', name: 'SliceGod', avatar: '🍕', reputation: 55, launches: 3, wins: 0, graduated: 0, totalHolders: 890, badges: ['Newcomer'] },
  { id: '5', name: 'SpookyDev', avatar: '👻', reputation: 67, launches: 6, wins: 1, graduated: 1, totalHolders: 2100, badges: ['Night Owl', 'Chaos Agent'] },
];

export const mockMissions: Mission[] = [
  { id: '1', title: 'First Blood', description: 'Reach 25 holders', progress: 18, target: 25, completed: false, reward: '🏆 Bronze Badge', icon: '⚔️' },
  { id: '2', title: 'Century Club', description: 'Hit 100 buys', progress: 100, target: 100, completed: true, reward: '🥈 Silver Badge', icon: '💯' },
  { id: '3', title: 'Survivor', description: 'Survive 24 hours', progress: 18, target: 24, completed: false, reward: '🛡️ Shield Badge', icon: '⏰' },
  { id: '4', title: 'Volume Monster', description: 'Reach $50K volume', progress: 34000, target: 50000, completed: false, reward: '💎 Diamond Badge', icon: '📊' },
  { id: '5', title: 'Community Power', description: 'Get 500 holders', progress: 247, target: 500, completed: false, reward: '👑 Crown Badge', icon: '🤝' },
];

export const mockActivities: Activity[] = [
  { id: '1', type: 'buy', user: '0xd3g3...n420', amount: 0.5, message: 'bought 0.5 SOL worth', timestamp: '2m ago' },
  { id: '2', type: 'buy', user: '0xm00n...beef', amount: 1.2, message: 'bought 1.2 SOL worth', timestamp: '3m ago' },
  { id: '3', type: 'sell', user: '0xpap3...hand', amount: 0.3, message: 'sold 0.3 SOL worth', timestamp: '5m ago' },
  { id: '4', type: 'holder', user: '0xfr0g...king', message: 'became a new holder', timestamp: '6m ago' },
  { id: '5', type: 'mission', user: '', message: '🏆 Century Club mission completed!', timestamp: '8m ago' },
  { id: '6', type: 'buy', user: '0xape...lord', amount: 2.0, message: 'bought 2.0 SOL worth', timestamp: '10m ago' },
  { id: '7', type: 'buy', user: '0xwhal...3000', amount: 5.0, message: 'bought 5.0 SOL worth 🐋', timestamp: '12m ago' },
  { id: '8', type: 'holder', user: '0xnew...b1e', message: 'became a new holder', timestamp: '15m ago' },
];

export const categories = ['All', 'Animal', 'AI', 'Chaos', 'Politics', 'Degen', 'Food', 'Celebrity'];
