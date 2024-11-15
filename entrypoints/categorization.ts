import { categories } from './categories';

export default defineUnlistedScript(() => {
  console.log('Script was injected!');
  return 'Hello John!';
});

export function categorizeBookmark(title: string, url: string): string {
  const text = `${title} ${url}`.toLowerCase();

  for (const category of categories) {
    for (const keyword of category.keywords) {
      if (text.includes(keyword)) {
        return category.name;
      }
    }
  }

  // Return 'Others' if no match is found
  return 'Others';
}
