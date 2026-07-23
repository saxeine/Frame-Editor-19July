import { useEffect, useMemo, useRef, useState } from "react";

type Lang = "en" | "sv";
type Theme = "light" | "dark" | "system";
type Accent = "violet" | "emerald" | "amber" | "rose";

type User = {
  id: string;
  name: string;
  bio: string;
  avatar: string;
};

type Recipe = {
  id: string;
  title: string;
  cuisine: string;
  minutes: number;
  servings: number;
  tags: string[];
  ingredients: { item: string; qty: string }[];
  steps: string[];
  image: string;
};

type MenuPlan = Record<string, string | null>; // day -> recipeId
type ShoppingItem = { id: string; name: string; qty: string; done: boolean; category?: string };
type Purchase = { id: string; date: string; total: number; items: { name: string; qty: string; price: number }[] };

type Page = "recipes" | "menu" | "purchases" | "shopping" | "settings";

const STR: Record<Lang, Record<string, string>> = {
  en: {
    recipes: "Recipes",
    menu: "Menu",
    purchases: "Purchases",
    shopping: "Shopping",
    settings: "Settings",
    search: "Search recipes, tags, ingredients…",
    filter: "Filter",
    all: "All",
    time: "Time",
    under30: "< 30m",
    under60: "< 60m",
    serves: "Serves",
    addToMenu: "Add to menu",
    view: "View",
    fav: "Favourite",
    ingredients: "Ingredients",
    steps: "Steps",
    addToShopping: "Add ingredients to shopping",
    menuPlanner: "Weekly menu",
    mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
    clear: "Clear",
    randomize: "Randomize",
    shoppingList: "Shopping list",
    uploadCSV: "Upload CSV",
    csvHelp: "CSV: name,qty,category (optional). One item per row.",
    markDone: "Mark done",
    remove: "Remove",
    addItem: "Add item",
    name: "Name",
    qty: "Qty",
    category: "Category",
    purchasesTitle: "Purchase history",
    total: "Total",
    date: "Date",
    newPurchase: "Log purchase",
    price: "Price",
    add: "Add",
    save: "Save",
    settingsTitle: "Settings",
    appearance: "Appearance",
    theme: "Theme",
    system: "System",
    light: "Light",
    dark: "Dark",
    accent: "Accent",
    language: "Language",
    english: "English",
    swedish: "Swedish",
    profile: "Profile",
    avatar: "Avatar",
    bio: "Bio",
    switchUser: "Switch user",
    newUser: "New user",
    currentUser: "Current user",
    manageUsers: "Manage users",
    deleteUser: "Delete user",
    resetDemo: "Reset demo data",
    exportData: "Export data",
    importData: "Import data",
    signedInAs: "Signed in as",
  },
  sv: {
    recipes: "Recept",
    menu: "Meny",
    purchases: "Inköp",
    shopping: "Inköpslista",
    settings: "Inställningar",
    search: "Sök recept, taggar, ingredienser…",
    filter: "Filter",
    all: "Alla",
    time: "Tid",
    under30: "< 30m",
    under60: "< 60m",
    serves: "Portioner",
    addToMenu: "Lägg i meny",
    view: "Visa",
    fav: "Favorit",
    ingredients: "Ingredienser",
    steps: "Steg",
    addToShopping: "Lägg ingredienser i inköpslista",
    menuPlanner: "Veckomeny",
    mon: "Mån", tue: "Tis", wed: "Ons", thu: "Tor", fri: "Fre", sat: "Lör", sun: "Sön",
    clear: "Rensa",
    randomize: "Slumpa",
    shoppingList: "Inköpslista",
    uploadCSV: "Ladda upp CSV",
    csvHelp: "CSV: namn,antal,kategori (valfri). Ett objekt per rad.",
    markDone: "Klar",
    remove: "Ta bort",
    addItem: "Lägg till",
    name: "Namn",
    qty: "Antal",
    category: "Kategori",
    purchasesTitle: "Inköpshistorik",
    total: "Summa",
    date: "Datum",
    newPurchase: "Logga inköp",
    price: "Pris",
    add: "Lägg till",
    save: "Spara",
    settingsTitle: "Inställningar",
    appearance: "Utseende",
    theme: "Tema",
    system: "System",
    light: "Ljust",
    dark: "Mörkt",
    accent: "Accent",
    language: "Språk",
    english: "Engelska",
    swedish: "Svenska",
    profile: "Profil",
    avatar: "Avatar",
    bio: "Bio",
    switchUser: "Byt användare",
    newUser: "Ny användare",
    currentUser: "Nuvarande användare",
    manageUsers: "Hantera användare",
    deleteUser: "Ta bort användare",
    resetDemo: "Återställ demodata",
    exportData: "Exportera data",
    importData: "Importera data",
    signedInAs: "Inloggad som",
  },
};

const DAYS: Array<keyof MenuPlan> = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const demoRecipes: Recipe[] = [
  {
    id: "r1",
    title: "Lemon Herb Salmon",
    cuisine: "Nordic",
    minutes: 25,
    servings: 2,
    tags: ["fish", "quick", "healthy"],
    ingredients: [
      { item: "Salmon fillet", qty: "400g" },
      { item: "Lemon", qty: "1" },
      { item: "Dill", qty: "1 bunch" },
      { item: "Olive oil", qty: "2 tbsp" },
      { item: "Potatoes", qty: "500g" },
    ],
    steps: [
      "Preheat oven to 200°C.",
      "Toss potatoes with oil, salt, roast 15 min.",
      "Top salmon with lemon and dill, roast 10 min.",
      "Serve with greens.",
    ],
    image:
      "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=1600&auto=format&fit=crop",
  },
  {
    id: "r2",
    title: "Mushroom Risotto",
    cuisine: "Italian",
    minutes: 45,
    servings: 4,
    tags: ["vegetarian", "comfort"],
    ingredients: [
      { item: "Arborio rice", qty: "320g" },
      { item: "Mixed mushrooms", qty: "400g" },
      { item: "Vegetable stock", qty: "1L" },
      { item: "Parmesan", qty: "80g" },
      { item: "White wine", qty: "100ml" },
    ],
    steps: ["Sauté mushrooms.", "Toast rice, deglaze with wine.", "Add stock gradually, stir.", "Finish with parmesan."],
    image:
      "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?q=80&w=1600&auto=format&fit=crop",
  },
  {
    id: "r3",
    title: "Chicken Shawarma Bowl",
    cuisine: "Middle Eastern",
    minutes: 30,
    servings: 2,
    tags: ["chicken", "bowl", "quick"],
    ingredients: [
      { item: "Chicken thighs", qty: "400g" },
      { item: "Shawarma spice", qty: "2 tbsp" },
      { item: "Basmati rice", qty: "200g" },
      { item: "Cucumber", qty: "1" },
      { item: "Yogurt", qty: "150g" },
    ],
    steps: ["Marinate chicken.", "Cook rice.", "Sear chicken, slice.", "Assemble with cucumber and yogurt."],
    image:
      "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1600&auto=format&fit=crop",
  },
  {
    id: "r4",
    title: "Veggie Tacos",
    cuisine: "Mexican",
    minutes: 20,
    servings: 3,
    tags: ["vegetarian", "quick", "tacos"],
    ingredients: [
      { item: "Corn tortillas", qty: "12" },
      { item: "Black beans", qty: "400g" },
      { item: "Corn", qty: "200g" },
      { item: "Avocado", qty: "2" },
      { item: "Lime", qty: "1" },
    ],
    steps: ["Warm tortillas.", "Sauté beans and corn.", "Mash avocado with lime.", "Assemble tacos."],
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1600&auto=format&fit=crop",
  },
  {
    id: "r5",
    title: "Köttbullar & Potatismos",
    cuisine: "Swedish",
    minutes: 40,
    servings: 4,
    tags: ["classic", "comfort"],
    ingredients: [
      { item: "Minced meat", qty: "600g" },
      { item: "Onion", qty: "1" },
      { item: "Potatoes", qty: "1kg" },
      { item: "Cream", qty: "200ml" },
      { item: "Lingonberry jam", qty: "to serve" },
    ],
    steps: ["Mix meat with onion, form balls.", "Fry until browned.", "Boil potatoes, mash with cream.", "Serve with lingonberries."],
    image:
      "https://images.unsplash.com/photo-1604908177078-49ed11c21734?q=80&w=1600&auto=format&fit=crop",
  },
];

const demoUsers: User[] = [
  { id: "u1", name: "Alex Rivera", bio: "Home cook, loves Nordic flavors", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop" },
  { id: "u2", name: "Maja Lind", bio: "Vegetarian, meal-prep enthusiast", avatar: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?q=80&w=200&auto=format&fit=crop" },
];

const demoPurchases: Purchase[] = [
  {
    id: "p1",
    date: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
    total: 42.9,
    items: [
      { name: "Salmon fillet", qty: "400g", price: 18.5 },
      { name: "Lemon", qty: "2", price: 1.2 },
      { name: "Potatoes", qty: "1kg", price: 2.2 },
      { name: "Dill", qty: "1", price: 1.5 },
      { name: "Olive oil", qty: "500ml", price: 6.9 },
      { name: "Mixed greens", qty: "200g", price: 2.6 },
    ],
  },
  {
    id: "p2",
    date: new Date(Date.now() - 86400000 * 10).toISOString().slice(0, 10),
    total: 28.4,
    items: [
      { name: "Arborio rice", qty: "500g", price: 3.9 },
      { name: "Mushrooms", qty: "400g", price: 4.5 },
      { name: "Parmesan", qty: "200g", price: 5.9 },
      { name: "White wine", qty: "750ml", price: 9.9 },
      { name: "Vegetable stock", qty: "1L", price: 1.2 },
    ],
  },
];

function useLocal<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function App() {
  const [lang, setLang] = useLocal<Lang>("ra_lang", "en");
  const t = STR[lang];

  const [theme, setTheme] = useLocal<Theme>("ra_theme", "system");
  const [accent, setAccent] = useLocal<Accent>("ra_accent", "violet");

  const [users, setUsers] = useLocal<User[]>("ra_users", demoUsers);
  const [currentUserId, setCurrentUserId] = useLocal<string>("ra_user_id", demoUsers[0].id);
  const currentUser = users.find((u) => u.id === currentUserId) ?? users[0];

  const [recipes] = useLocal<Recipe[]>("ra_recipes", demoRecipes);
  const [menu, setMenu] = useLocal<MenuPlan>("ra_menu", { mon: "r1", tue: "r3", wed: null, thu: "r2", fri: "r4", sat: "r5", sun: null });
  const [shopping, setShopping] = useLocal<ShoppingItem[]>("ra_shopping", [
    { id: uid(), name: "Salmon fillet", qty: "400g", done: false, category: "Fish" },
    { id: uid(), name: "Lemon", qty: "2", done: false, category: "Produce" },
    { id: uid(), name: "Dill", qty: "1 bunch", done: true, category: "Produce" },
  ]);
  const [purchases, setPurchases] = useLocal<Purchase[]>("ra_purchases", demoPurchases);

  const [page, setPage] = useState<Page>("recipes");
  const [query, setQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState<"all" | "30" | "60">("all");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = theme === "dark" || (theme === "system" && prefersDark);
    root.classList.toggle("dark", dark);
    root.dataset.accent = accent;
  }, [theme, accent]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      const matchesQuery =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.cuisine.toLowerCase().includes(q) ||
        r.tags.some((x) => x.toLowerCase().includes(q)) ||
        r.ingredients.some((i) => i.item.toLowerCase().includes(q));
      const matchesTime = timeFilter === "all" || (timeFilter === "30" ? r.minutes < 30 : r.minutes < 60);
      return matchesQuery && matchesTime;
    });
  }, [recipes, query, timeFilter]);

  function addIngredientsToShopping(r: Recipe) {
    const existing = new Map(shopping.map((s) => [s.name.toLowerCase(), s]));
    const additions: ShoppingItem[] = [];
    r.ingredients.forEach((ing) => {
      const key = ing.item.toLowerCase();
      if (!existing.has(key)) {
        additions.push({ id: uid(), name: ing.item, qty: ing.qty, done: false });
      }
    });
    setShopping([...shopping, ...additions]);
    setPage("shopping");
  }

  function handleCSV(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const lines = text.split(/\r?\n/).filter(Boolean);
      const items: ShoppingItem[] = [];
      for (const line of lines) {
        const [name, qty = "", category = ""] = line.split(",").map((s) => s.trim());
        if (!name) continue;
        items.push({ id: uid(), name, qty: qty || "1", done: false, category: category || undefined });
      }
      if (items.length) setShopping((prev) => [...items, ...prev]);
    };
    reader.readAsText(file);
  }

  const accentClasses: Record<Accent, string> = {
    violet: "from-violet-600 to-indigo-600",
    emerald: "from-emerald-600 to-teal-600",
    amber: "from-amber-500 to-orange-600",
    rose: "from-rose-600 to-pink-600",
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_800px_at_80%_-10%,rgba(99,102,241,0.12),transparent),radial-gradient(800px_600px_at_10%_110%,rgba(16,185,129,0.10),transparent)] dark:bg-[radial-gradient(1200px_800px_at_80%_-10%,rgba(99,102,241,0.18),transparent),radial-gradient(800px_600px_at_10%_110%,rgba(16,185,129,0.16),transparent)] text-zinc-900 dark:text-zinc-100">
      {/* Top bar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-zinc-900/60 border-b border-zinc-200/60 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cx("h-8 w-8 rounded-xl bg-gradient-to-br shadow-md", accentClasses[accent])} />
            <div className="font-semibold tracking-tight">Recipe Atlas</div>
            <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">{lang.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <span className="opacity-70">{t.signedInAs}</span>
              <span className="font-medium">{currentUser.name}</span>
            </div>
            <img src={currentUser.avatar} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-zinc-300/60 dark:ring-zinc-700" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 pb-28 sm:pb-10">
        {/* RECIPES */}
        {page === "recipes" && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <h1 className="text-2xl font-semibold tracking-tight">{t.recipes}</h1>
              <div className="flex gap-2">
                <div className="relative flex-1 sm:w-80">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t.search}
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 outline-none focus:ring-2 focus:ring-violet-500/30"
                  />
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value as any)}
                  className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60"
                >
                  <option value="all">{t.all}</option>
                  <option value="30">{t.under30}</option>
                  <option value="60">{t.under60}</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((r) => (
                <article key={r.id} className="group relative overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 shadow-sm hover:shadow-md transition">
                  <div className="aspect-[16/10] overflow-hidden">
                    <img src={r.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-medium leading-tight">{r.title}</h3>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">{r.cuisine}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1"><ClockIcon /> {r.minutes}m</span>
                      <span className="inline-flex items-center gap-1"><UsersIcon /> {r.servings}</span>
                      <span className="inline-flex items-center gap-1"><TagIcon /> {r.tags.join(" · ")}</span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setSelectedRecipe(r)} className="h-9 px-3 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm">{t.view}</button>
                      <button onClick={() => addIngredientsToShopping(r)} className="h-9 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm">{t.addToShopping}</button>
                      <button onClick={() => setMenu((m) => ({ ...m, [nextEmptyDay(m)]: r.id }))} className="h-9 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm">{t.addToMenu}</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* MENU */}
        {page === "menu" && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold tracking-tight">{t.menuPlanner}</h1>
              <div className="flex gap-2">
                <button onClick={() => setMenu(Object.fromEntries(DAYS.map(d => [d, null]))) } className="h-9 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm">{t.clear}</button>
                <button onClick={() => setMenu(randomMenu(recipes))} className="h-9 px-3 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm">{t.randomize}</button>
              </div>
            </div>
            <div className="grid md:grid-cols-7 gap-3">
              {DAYS.map((d) => {
                const rid = menu[d];
                const r = recipes.find((x) => x.id === rid) || null;
                return (
                  <div key={d} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 p-3 flex flex-col gap-2">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">{t[d as keyof typeof t] || d}</div>
                    {r ? (
                      <>
                        <img src={r.image} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />
                        <div className="font-medium text-sm leading-tight">{r.title}</div>
                        <div className="text-xs text-zinc-500">{r.minutes}m · {r.servings} {t.serves.toLowerCase()}</div>
                        <div className="flex gap-2 mt-1">
                          <button onClick={() => setSelectedRecipe(r)} className="h-8 px-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs">{t.view}</button>
                          <button onClick={() => setMenu({ ...menu, [d]: null })} className="h-8 px-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs">{t.clear}</button>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 grid place-items-center text-xs text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl py-8">
                        —
                      </div>
                    )}
                    <select
                      value={rid ?? ""}
                      onChange={(e) => setMenu({ ...menu, [d]: e.target.value || null })}
                      className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 text-sm"
                    >
                      <option value="">{t.all}…</option>
                      {recipes.map((rr) => <option key={rr.id} value={rr.id}>{rr.title}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* PURCHASES */}
        {page === "purchases" && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold tracking-tight">{t.purchasesTitle}</h1>
              <AddPurchase onAdd={(p) => setPurchases([p, ...purchases])} t={t} />
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              {purchases.map((p) => (
                <div key={p.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-zinc-500">{t.date}: {p.date}</div>
                    <div className="text-sm font-medium">{t.total}: {p.total.toFixed(2)}</div>
                  </div>
                  <div className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
                    {p.items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between py-2 text-sm">
                        <div className="truncate">{it.name} <span className="text-zinc-500">· {it.qty}</span></div>
                        <div className="tabular-nums">{it.price.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SHOPPING */}
        {page === "shopping" && (
          <section className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{t.shoppingList}</h1>
              <div className="flex items-center gap-2">
                <label className="h-9 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm inline-flex items-center gap-2 cursor-pointer">
                  <UploadIcon />
                  {t.uploadCSV}
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleCSV(e.target.files[0])} />
                </label>
                <span className="text-xs text-zinc-500 hidden sm:block">{t.csvHelp}</span>
              </div>
            </div>

            <AddShoppingItem onAdd={(name, qty, category) => setShopping([{ id: uid(), name, qty, done: false, category }, ...shopping])} t={t} />

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 divide-y divide-zinc-200 dark:divide-zinc-800">
              {shopping.length === 0 && (
                <div className="p-8 text-center text-sm text-zinc-500">—</div>
              )}
              {shopping.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-3">
                  <button
                    onClick={() => setShopping(shopping.map((x) => x.id === s.id ? { ...x, done: !x.done } : x))}
                    className={cx("h-6 w-6 grid place-items-center rounded-md border", s.done ? "bg-emerald-600 border-emerald-600 text-white" : "border-zinc-300 dark:border-zinc-700")}
                    aria-label={t.markDone}
                  >
                    {s.done && <CheckIcon />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={cx("truncate text-sm", s.done && "line-through opacity-60")}>{s.name}</div>
                    <div className="text-[11px] text-zinc-500">{[s.qty, s.category].filter(Boolean).join(" · ")}</div>
                  </div>
                  <button onClick={() => setShopping(shopping.filter((x) => x.id !== s.id))} className="h-8 px-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs">{t.remove}</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SETTINGS */}
        {page === "settings" && (
          <section className="space-y-8">
            <h1 className="text-2xl font-semibold tracking-tight">{t.settingsTitle}</h1>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Appearance */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 p-5">
                <h2 className="font-medium mb-3">{t.appearance}</h2>
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">{t.theme}</div>
                    <div className="flex gap-2">
                      {(["system", "light", "dark"] as Theme[]).map((opt) => (
                        <button key={opt} onClick={() => setTheme(opt)} className={cx("h-9 px-3 rounded-lg border text-sm", theme === opt ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 dark:border-white" : "border-zinc-300 dark:border-zinc-700")}>
                          {t[opt as keyof typeof t] || opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">{t.accent}</div>
                    <div className="flex gap-2">
                      {(["violet", "emerald", "amber", "rose"] as Accent[]).map((a) => (
                        <button key={a} onClick={() => setAccent(a)} className={cx("h-9 w-9 rounded-full ring-2 ring-offset-2 ring-offset-transparent", accent === a ? "ring-zinc-900 dark:ring-white" : "ring-transparent")}>
                          <span className={cx("block h-full w-full rounded-full bg-gradient-to-br", accentClasses[a])} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">{t.language}</div>
                    <div className="flex gap-2">
                      <button onClick={() => setLang("en")} className={cx("h-9 px-3 rounded-lg border text-sm", lang === "en" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 dark:border-white" : "border-zinc-300 dark:border-zinc-700")}>{t.english}</button>
                      <button onClick={() => setLang("sv")} className={cx("h-9 px-3 rounded-lg border text-sm", lang === "sv" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 dark:border-white" : "border-zinc-300 dark:border-zinc-700")}>{t.swedish}</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profile */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 p-5">
                <h2 className="font-medium mb-3">{t.profile}</h2>
                <div className="flex items-center gap-4">
                  <img src={currentUser.avatar} alt="" className="h-14 w-14 rounded-2xl object-cover ring-1 ring-zinc-300/60 dark:ring-zinc-700" />
                  <div className="flex-1">
                    <label className="text-xs text-zinc-500">{t.avatar} URL</label>
                    <input
                      value={currentUser.avatar}
                      onChange={(e) => setUsers(users.map(u => u.id === currentUser.id ? { ...u, avatar: e.target.value } : u))}
                      className="mt-1 w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60"
                    />
                  </div>
                </div>
                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500">{t.currentUser}</label>
                    <input
                      value={currentUser.name}
                      onChange={(e) => setUsers(users.map(u => u.id === currentUser.id ? { ...u, name: e.target.value } : u))}
                      className="mt-1 w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500">{t.bio}</label>
                    <input
                      value={currentUser.bio}
                      onChange={(e) => setUsers(users.map(u => u.id === currentUser.id ? { ...u, bio: e.target.value } : u))}
                      className="mt-1 w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60"
                    />
                  </div>
                </div>

                <div className="mt-5">
                  <div className="text-xs text-zinc-500 mb-1">{t.switchUser}</div>
                  <div className="flex flex-wrap gap-2">
                    {users.map((u) => (
                      <button key={u.id} onClick={() => setCurrentUserId(u.id)} className={cx("h-9 px-3 rounded-lg border text-sm inline-flex items-center gap-2", currentUserId === u.id ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 dark:border-white" : "border-zinc-300 dark:border-zinc-700")}>
                        <img src={u.avatar} alt="" className="h-5 w-5 rounded-full object-cover" />
                        {u.name}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        const id = uid();
                        setUsers([...users, { id, name: "New user", bio: "", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop" }]);
                        setCurrentUserId(id);
                      }}
                      className="h-9 px-3 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-sm"
                    >
                      + {t.newUser}
                    </button>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button onClick={() => {
                    if (users.length <= 1) return;
                    const next = users.find(u => u.id !== currentUserId)!;
                    setUsers(users.filter(u => u.id !== currentUserId));
                    setCurrentUserId(next.id);
                  }} className="h-9 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm">{t.deleteUser}</button>
                  <button onClick={() => {
                    localStorage.clear();
                    location.reload();
                  }} className="h-9 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm">{t.resetDemo}</button>
                  <ExportImport t={t} />
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Bottom nav (mobile) + side nav (desktop) */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-zinc-200/70 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl sm:hidden">
        <div className="mx-auto max-w-6xl grid grid-cols-5">
          {[
            { k: "recipes", icon: <BookIcon /> },
            { k: "menu", icon: <CalendarIcon /> },
            { k: "purchases", icon: <ReceiptIcon /> },
            { k: "shopping", icon: <CartIcon /> },
            { k: "settings", icon: <GearIcon /> },
          ].map((item) => (
            <button key={item.k} onClick={() => setPage(item.k as Page)} className={cx("h-14 flex flex-col items-center justify-center gap-1 text-[11px]", page === item.k ? "text-zinc-900 dark:text-white" : "text-zinc-500")}>
              <span className={cx("grid place-items-center h-6 w-6 rounded-lg", page === item.k && "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900")}>{item.icon}</span>
              {t[item.k as keyof typeof t]}
            </button>
          ))}
        </div>
      </nav>

      <aside className="hidden sm:block fixed left-0 top-14 bottom-0 w-[84px] border-r border-zinc-200/70 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl">
        <div className="h-full flex flex-col items-center py-4 gap-3">
          {[
            { k: "recipes", icon: <BookIcon /> },
            { k: "menu", icon: <CalendarIcon /> },
            { k: "purchases", icon: <ReceiptIcon /> },
            { k: "shopping", icon: <CartIcon /> },
            { k: "settings", icon: <GearIcon /> },
          ].map((item) => (
            <button key={item.k} onClick={() => setPage(item.k as Page)} title={t[item.k as keyof typeof t]} className={cx("group relative h-12 w-12 grid place-items-center rounded-2xl border transition", page === item.k ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 dark:border-white" : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800")}>
              {item.icon}
              <span className="pointer-events-none absolute left-[72px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition">{t[item.k as keyof typeof t]}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Recipe modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedRecipe(null)} />
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl">
            <div className="relative h-56 w-full overflow-hidden">
              <img src={selectedRecipe.image} alt="" className="h-full w-full object-cover" />
              <button onClick={() => setSelectedRecipe(null)} className="absolute right-3 top-3 h-9 w-9 grid place-items-center rounded-full bg-black/60 text-white">✕</button>
              <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/70 to-transparent text-white">
                <div className="text-xl font-semibold">{selectedRecipe.title}</div>
                <div className="text-sm opacity-90">{selectedRecipe.cuisine} · {selectedRecipe.minutes}m · {selectedRecipe.servings} {t.serves.toLowerCase()}</div>
              </div>
            </div>
            <div className="grid md:grid-cols-5 gap-6 p-5">
              <div className="md:col-span-2">
                <h3 className="font-medium mb-2">{t.ingredients}</h3>
                <ul className="space-y-1.5 text-sm">
                  {selectedRecipe.ingredients.map((i, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-3">
                      <span className="truncate">{i.item}</span>
                      <span className="text-zinc-500">{i.qty}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={() => { addIngredientsToShopping(selectedRecipe); setSelectedRecipe(null); }} className="mt-4 h-9 px-3 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm">{t.addToShopping}</button>
              </div>
              <div className="md:col-span-3">
                <h3 className="font-medium mb-2">{t.steps}</h3>
                <ol className="list-decimal pl-5 space-y-2 text-sm">
                  {selectedRecipe.steps.map((s, idx) => <li key={idx}>{s}</li>)}
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function nextEmptyDay(menu: MenuPlan): keyof MenuPlan {
  return (DAYS.find((d) => !menu[d]) ?? "mon") as keyof MenuPlan;
}

function randomMenu(recipes: Recipe[]): MenuPlan {
  const pick = () => recipes[Math.floor(Math.random() * recipes.length)].id;
  return Object.fromEntries(DAYS.map((d) => [d, Math.random() > 0.3 ? pick() : null])) as MenuPlan;
}

function AddShoppingItem({ onAdd, t }: { onAdd: (name: string, qty: string, category?: string) => void; t: Record<string, string> }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [cat, setCat] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd(name.trim(), qty.trim() || "1", cat.trim() || undefined);
        setName(""); setQty(""); setCat("");
      }}
      className="flex flex-wrap gap-2"
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.name} className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 flex-1 min-w-[160px]" />
      <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder={t.qty} className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 w-28" />
      <input value={cat} onChange={(e) => setCat(e.target.value)} placeholder={t.category} className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 w-36" />
      <button className="h-10 px-4 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm">{t.addItem}</button>
    </form>
  );
}

function AddPurchase({ onAdd, t }: { onAdd: (p: Purchase) => void; t: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<{ name: string; qty: string; price: string }[]>([{ name: "", qty: "", price: "" }]);
  const total = items.reduce((sum, it) => sum + (parseFloat(it.price) || 0), 0);

  if (!open) {
    return <button onClick={() => setOpen(true)} className="h-9 px-3 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm">{t.newPurchase}</button>;
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium">{t.newPurchase}</div>
          <button onClick={() => setOpen(false)} className="h-8 w-8 grid place-items-center rounded-lg border border-zinc-300 dark:border-zinc-700">✕</button>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className="text-xs text-zinc-500">{t.date}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-zinc-500">{t.total}</label>
            <div className="mt-1 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 grid items-center">{total.toFixed(2)}</div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2">
              <input placeholder={t.name} value={it.name} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} className="col-span-6 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60" />
              <input placeholder={t.qty} value={it.qty} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, qty: e.target.value } : x))} className="col-span-3 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60" />
              <input placeholder={t.price} inputMode="decimal" value={it.price} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, price: e.target.value } : x))} className="col-span-3 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60" />
            </div>
          ))}
          <button onClick={() => setItems([...items, { name: "", qty: "", price: "" }])} className="h-8 px-3 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-xs">+ {t.add}</button>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className="h-9 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm">{t.clear}</button>
          <button
            onClick={() => {
              const cleaned = items.filter((x) => x.name.trim()).map((x) => ({ name: x.name.trim(), qty: x.qty.trim() || "1", price: parseFloat(x.price) || 0 }));
              onAdd({ id: uid(), date, total, items: cleaned });
              setOpen(false);
            }}
            className="h-9 px-3 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm"
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExportImport({ t }: { t: Record<string, string> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex gap-2">
      <button
        onClick={() => {
          const data = {
            lang: localStorage.getItem("ra_lang"),
            theme: localStorage.getItem("ra_theme"),
            accent: localStorage.getItem("ra_accent"),
            users: localStorage.getItem("ra_users"),
            userId: localStorage.getItem("ra_user_id"),
            recipes: localStorage.getItem("ra_recipes"),
            menu: localStorage.getItem("ra_menu"),
            shopping: localStorage.getItem("ra_shopping"),
            purchases: localStorage.getItem("ra_purchases"),
          };
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "recipe-atlas.json";
          a.click();
          URL.revokeObjectURL(url);
        }}
        className="h-9 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm"
      >
        {t.exportData}
      </button>
      <button onClick={() => fileRef.current?.click()} className="h-9 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm">{t.importData}</button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const data = JSON.parse(String(reader.result));
              Object.entries(data).forEach(([k, v]) => {
                if (v) localStorage.setItem(`ra_${k}`, typeof v === "string" ? v : JSON.stringify(v));
              });
              location.reload();
            } catch { /* ignore */ }
          };
          reader.readAsText(f);
        }}
      />
    </div>
  );
}

/* Icons */
function BookIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5z"/><path d="M8 6h8M8 10h8M8 14h5"/></svg>;
}
function CalendarIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
}
function ReceiptIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>;
}
function CartIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>;
}
function GearIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8.9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.7.206 1.165.88 1.1 1.61V11a2 2 0 1 1 0 4h-.09c-.7.206-1.165.88-1.1 1.61z"/></svg>;
}
function ClockIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>;
}
function UsersIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function TagIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41 12 22l-8-8 8.59-8.59A2 2 0 0 1 14 5h6v6c0 .53-.21 1.04-.59 1.41z"/><circle cx="17" cy="8" r="1.5"/></svg>;
}
function UploadIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>;
}
function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>;
}