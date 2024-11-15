export default defineUnlistedScript(() => {
  console.log('Script was injected!');
  return 'Hello John!';
});

export const categories = [
  {
    name: 'News',
    keywords: ['news', 'media', 'broadcast', 'press'],
  },
  {
    name: 'Technology',
    keywords: ['tech', 'software', 'computer', 'programming', 'coding'],
  },
  {
    name: 'Sports',
    keywords: ['sports', 'football', 'soccer', 'basketball', 'tennis'],
  },
  {
    name: 'Education',
    keywords: ['education', 'learning', 'school', 'university', 'course'],
  },
  {
    name: 'Entertainment',
    keywords: ['entertainment', 'movies', 'music', 'games', 'videos'],
  },
  {
    name: 'Others',
    keywords: [],
  },
];
