import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  ArrowRight, BarChart3, Check, ChevronLeft, CircleUserRound, Heart, Loader2, LockKeyhole,
  Menu, Minus, Package, Plus, Search, ShoppingBag, SlidersHorizontal, Sparkles, Star,
  TrendingUp, Truck, X,
} from 'lucide-react';
import {
  getGetProductRecommendationsQueryKey, getGetWishlistQueryKey,
  useCreateReview, useListProductReviews, useUpdateCustomerProfile,
  useCreateOrder, useGetAnalyticsDashboard, useGetCustomerProfile, useGetProduct,
  useGetProductRecommendations, useGetRecentActivity, useGetWishlist, useListCategories,
  useListOrders, useListProducts, useToggleWishlist, useTrackActivity,
} from '@workspace/api-client-react';
import type { AnalyticsDashboard, Category, Order, Product, Recommendation } from '@workspace/api-client-react';
import { Link, Redirect, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#F16B56',
    colorForeground: '#20243B',
    colorMutedForeground: '#6F7180',
    colorDanger: '#B83A49',
    colorBackground: '#F4F0E9',
    colorInput: '#FCFAF6',
    colorInputForeground: '#20243B',
    colorNeutral: '#D8D4CC',
    fontFamily: 'Manrope, sans-serif',
    borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#F4F0E9] rounded-3xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'display-font text-[#20243B]',
    headerSubtitle: 'text-[#6F7180]',
    socialButtonsBlockButtonText: 'text-[#20243B]',
    formFieldLabel: 'text-[#20243B]',
    footerActionLink: 'text-[#20243B]',
    footerActionText: 'text-[#6F7180]',
    dividerText: 'text-[#6F7180]',
    formButtonPrimary: 'bg-[#F16B56] hover:bg-[#df5a46] text-[#20243B]',
    formFieldInput: 'bg-[#FCFAF6] border-[#D8D4CC] text-[#20243B]',
    socialButtonsBlockButton: 'bg-[#FCFAF6] border-[#D8D4CC]',
    dividerLine: 'bg-[#D8D4CC]',
    main: 'bg-transparent',
  },
};
const CUSTOMER_ID = 1;
const FALLBACK_IMAGES = [
  'https://images.pexels.com/photos/5709661/pexels-photo-5709661.jpeg?auto=compress&cs=tinysrgb&w=900',
  'https://images.pexels.com/photos/6044266/pexels-photo-6044266.jpeg?auto=compress&cs=tinysrgb&w=900',
  'https://images.pexels.com/photos/5698851/pexels-photo-5698851.jpeg?auto=compress&cs=tinysrgb&w=900',
  'https://images.pexels.com/photos/6207817/pexels-photo-6207817.jpeg?auto=compress&cs=tinysrgb&w=900',
];

type CartLine = { product: Product; quantity: number };
type CartContextValue = { items: CartLine[]; add: (product: Product) => void; remove: (id: number) => void; setQuantity: (id: number, quantity: number) => void; clear: () => void; count: number; total: number };
const CartContext = createContext<CartContextValue | null>(null);

function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>(() => {
    try { return JSON.parse(localStorage.getItem('ic-cart') || '[]') as CartLine[]; } catch { return []; }
  });
  useEffect(() => { localStorage.setItem('ic-cart', JSON.stringify(items)); }, [items]);
  const value = useMemo<CartContextValue>(() => ({
    items,
     add: (product) => setItems((current) => {
       if (product.stock <= 0) return current;
      const match = current.find((line) => line.product.id === product.id);
      return match ? current.map((line) => line.product.id === product.id ? { ...line, quantity: Math.min(line.quantity + 1, product.stock || 99) } : line) : [...current, { product, quantity: 1 }];
    }),
    remove: (id) => setItems((current) => current.filter((line) => line.product.id !== id)),
     setQuantity: (id, quantity) => setItems((current) => quantity < 1 ? current.filter((line) => line.product.id !== id) : current.map((line) => line.product.id === id ? { ...line, quantity: Math.min(quantity, line.product.stock) } : line)),
    clear: () => setItems([]),
    count: items.reduce((sum, line) => sum + line.quantity, 0),
    total: items.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
  }), [items]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
}

function currency(value: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value); }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)); }
function img(product: Product, index = 0) { return product.imageUrl || FALLBACK_IMAGES[(product.id + index) % FALLBACK_IMAGES.length]; }

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const isAdmin = user?.publicMetadata?.role === 'admin' || user?.publicMetadata?.isAdmin === true;
  const links = isSignedIn
    ? [['Shop', '/shop'], ['Our approach', '/#approach'], ['Profile', '/account'], ['My Orders', '/account'], ['Wishlist', '/account'], ...(isAdmin ? [['Analytics', '/admin']] : [])]
    : [['Shop', '/shop'], ['Our approach', '/#approach'], ['Login', '/sign-in'], ['Register', '/sign-up']];
  return (
    <div className="noise min-h-[100dvh] bg-background text-foreground">
      <div className="border-b border-foreground/10 bg-secondary/45 px-4 py-2 text-center text-[10px] font-bold uppercase tracking-[.22em] text-foreground/70 sm:text-xs">Free delivery on orders over $75 · Thoughtful objects, better days</div>
      <header className="sticky top-0 z-40 border-b border-foreground/10 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-4 sm:px-8">
          <Link href="/" className="group flex items-center gap-3" data-testid="link-logo">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground"><Sparkles size={18} /></span>
            <span><span className="display-font block text-xl font-bold leading-none">intelligent</span><span className="mono-font text-[9px] uppercase tracking-[.27em] text-muted-foreground">commerce / 01</span></span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            {links.map(([label, href]) => <Link key={href} href={href} className={`text-sm font-semibold ${location === href ? 'text-primary' : 'text-foreground/65 hover:text-foreground'}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}>{label}</Link>)}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/shop" className="hidden rounded-full p-3 text-foreground/65 hover:bg-muted hover:text-foreground sm:block" data-testid="link-search"><Search size={18} /></Link>
            {isSignedIn ? <><Link href="/account" className="hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-foreground/70 hover:bg-muted hover:text-foreground sm:flex" data-testid="link-account"><CircleUserRound size={17} />{user?.firstName || user?.username || 'Profile'}</Link><button onClick={() => signOut({ redirectUrl: basePath || '/' })} className="hidden rounded-full border border-foreground/15 px-3 py-2 text-xs font-bold text-foreground/70 hover:border-primary hover:text-primary sm:block" data-testid="button-logout">Logout</button></> : null}
            <Link href="/cart" className="relative rounded-full bg-foreground p-3 text-background hover:-translate-y-0.5" data-testid="link-cart"><ShoppingBag size={18} /><span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground" data-testid="text-cart-count">{count}</span></Link>
            <button className="rounded-full p-3 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu" data-testid="button-menu"><Menu size={20} /></button>
          </div>
        </div>
         {menuOpen && <nav className="border-t border-foreground/10 px-5 py-4 md:hidden">{links.map(([label, href]) => <Link onClick={() => setMenuOpen(false)} key={`${label}-${href}`} href={href} className="block border-b border-foreground/10 py-3 text-sm font-semibold" data-testid={`link-mobile-${label.toLowerCase().replaceAll(' ', '-')}`}>{label}</Link>)}{isSignedIn && <button onClick={() => signOut({ redirectUrl: basePath || '/' })} className="block w-full border-b border-foreground/10 py-3 text-left text-sm font-semibold" data-testid="button-mobile-logout">Logout</button>}</nav>}
      </header>
      <main>{children}</main>
      <ContextPanels />
      <footer className="mt-24 bg-foreground px-5 py-12 text-background sm:px-8">
        <div className="mx-auto grid max-w-[1440px] gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div><span className="display-font text-3xl font-bold">intelligent<br />commerce.</span><p className="mt-5 max-w-xs text-sm leading-6 text-background/60">A considered shop for considered living. Every recommendation has a reason.</p></div>
          <div><p className="mono-font mb-4 text-[10px] uppercase tracking-[.2em] text-background/45">Explore</p><Link href="/shop" className="block py-1 text-sm hover:text-primary">All objects</Link><Link href="/#approach" className="block py-1 text-sm hover:text-primary">Our approach</Link></div>
          <div><p className="mono-font mb-4 text-[10px] uppercase tracking-[.2em] text-background/45">Help</p><Link href="/account" className="block py-1 text-sm hover:text-primary">Your account</Link><Link href="/cart" className="block py-1 text-sm hover:text-primary">Shipping & returns</Link></div>
          <div><p className="mono-font mb-4 text-[10px] uppercase tracking-[.2em] text-background/45">Project note</p><p className="text-sm leading-6 text-background/60">Intelligent Commerce pairs a lifestyle storefront with a transparent recommendation engine and customer analytics.</p></div>
        </div>
      </footer>
    </div>
  );
}

function ContextPanels() {
  const [location] = useLocation();
  const { isSignedIn } = useUser();
  const productMatch = location.match(/^\/product\/(\d+)/);
  const productId = productMatch ? Number(productMatch[1]) : 0;
  const reviews = useListProductReviews(productId, { query: { queryKey: ['product-reviews', productId], enabled: Boolean(productMatch) } });
  const createReview = useCreateReview();
  const profile = useGetCustomerProfile(CUSTOMER_ID, { query: { queryKey: ['customer-profile', CUSTOMER_ID], enabled: location === '/account' && isSignedIn === true } });
  const updateProfile = useUpdateCustomerProfile();
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileGender, setProfileGender] = useState('');
  const [profileAge, setProfileAge] = useState<number | ''>('');
  const [profileCity, setProfileCity] = useState('');
  useEffect(() => {
    if (profile.data) {
      setProfileName(profile.data.name);
      setProfileEmail(profile.data.email);
      setProfileGender(profile.data.gender || '');
      setProfileAge(profile.data.age ?? '');
      setProfileCity(profile.data.city || '');
    }
  }, [profile.data]);
  if (productMatch) {
    return <section className="mx-auto mt-16 max-w-[1440px] border-t border-foreground/10 px-4 py-10 sm:px-8"><div className="grid gap-10 lg:grid-cols-[1fr_.8fr]"><div><p className="mono-font text-[10px] uppercase tracking-[.2em] text-primary">Customer voice</p><h2 className="display-font mt-2 text-4xl font-bold">Reviews.</h2>{reviews.isLoading ? <div className="mt-6 h-24 animate-pulse rounded-2xl bg-muted" /> : reviews.data?.length ? <div className="mt-6 space-y-4">{reviews.data.map((review) => <article key={review.id} className="rounded-2xl border border-foreground/10 bg-card p-5"><div className="flex items-center justify-between"><strong className="text-sm">{review.customerName}</strong><span className="text-primary">{'★'.repeat(review.rating)}<span className="text-muted-foreground">{'★'.repeat(5 - review.rating)}</span></span></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{review.body}</p><p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">{formatDate(review.createdAt)}</p></article>)}</div> : <p className="mt-6 text-sm text-muted-foreground">Be the first to share a considered opinion.</p>}</div><form className="h-fit rounded-2xl bg-card p-6 ring-1 ring-foreground/10" onSubmit={(event) => { event.preventDefault(); createReview.mutate({ data: { customerId: CUSTOMER_ID, productId, rating, body: reviewBody } }, { onSuccess: () => { setReviewBody(''); reviews.refetch(); } }); }}><p className="text-sm font-bold">Leave a review</p><label className="mt-5 block text-xs font-bold">Rating<select value={rating} onChange={(event) => setRating(Number(event.target.value))} className="mt-2 h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-sm"><option value="5">5 — Excellent</option><option value="4">4 — Very good</option><option value="3">3 — Good</option><option value="2">2 — Fair</option><option value="1">1 — Poor</option></select></label><label className="mt-4 block text-xs font-bold">Your experience<textarea required minLength={3} value={reviewBody} onChange={(event) => setReviewBody(event.target.value)} className="mt-2 min-h-28 w-full rounded-xl border border-foreground/15 bg-background p-3 text-sm outline-none focus:border-primary" placeholder="What stood out?" /></label><button disabled={createReview.isPending} className="mt-4 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">Publish review</button></form></div></section>;
  }
  if (location === '/account') {
    return <section className="mx-auto mt-12 max-w-[1200px] px-4 sm:px-8"><div className="flex items-center justify-between"><div><p className="mono-font text-[10px] uppercase tracking-[.2em] text-primary">Your details</p><h2 className="display-font mt-2 text-4xl font-bold">Profile.</h2></div><button onClick={() => setProfileOpen((open) => !open)} className="rounded-full border border-foreground/15 px-4 py-2 text-xs font-bold">{profileOpen ? 'Close editor' : 'Edit profile'}</button></div>{profileOpen && <form className="mt-6 grid gap-4 rounded-2xl bg-card p-6 ring-1 ring-foreground/10 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); updateProfile.mutate({ id: CUSTOMER_ID, data: { name: profileName, email: profileEmail, gender: profileGender || null, age: profileAge === '' ? null : profileAge, city: profileCity || null } }, { onSuccess: () => setProfileOpen(false) }); }}><label className="text-xs font-bold">Name<input required minLength={2} value={profileName} onChange={(event) => setProfileName(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-sm" /></label><label className="text-xs font-bold">Email<input required type="email" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-sm" /></label><label className="text-xs font-bold">Gender<input value={profileGender} onChange={(event) => setProfileGender(event.target.value)} placeholder="Optional" className="mt-2 h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-sm" /></label><label className="text-xs font-bold">Age<input type="number" min="13" max="120" value={profileAge} onChange={(event) => setProfileAge(event.target.value === '' ? '' : Number(event.target.value))} placeholder="Optional" className="mt-2 h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-sm" /></label><label className="text-xs font-bold sm:col-span-2">City<input value={profileCity} onChange={(event) => setProfileCity(event.target.value)} placeholder="Optional" className="mt-2 h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-sm" /></label><button disabled={updateProfile.isPending} className="w-fit rounded-full bg-foreground px-5 py-3 text-sm font-bold text-background disabled:opacity-60">Save profile</button></form>}</section>;
  }
  return null;
}

function LoadingGrid({ count = 4 }: { count?: number }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">{Array.from({ length: count }).map((_, index) => <div className="animate-pulse" key={index}><div className="skeleton-sheen aspect-[.85] rounded-2xl" /><div className="mt-3 h-3 w-2/3 rounded bg-muted" /><div className="mt-2 h-3 w-1/3 rounded bg-muted" /></div>)}</div>;
}
function QueryError({ onRetry }: { onRetry?: () => void }) {
  return <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-8 text-center"><p className="font-semibold">This view is taking a moment.</p><p className="mt-1 text-sm text-muted-foreground">We couldn’t load the latest data.</p><button onClick={onRetry} className="mt-4 rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background" data-testid="button-retry">Try again</button></div>;
}
function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="rounded-2xl border border-dashed border-foreground/20 bg-card/50 px-5 py-16 text-center"><Package className="mx-auto text-muted-foreground" size={28} /><p className="mt-4 font-semibold">{title}</p><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{detail}</p></div>; }

function Stars({ rating }: { rating: number }) {
  return <span className="inline-flex items-center gap-1 text-xs font-semibold"><Star size={13} className="fill-primary text-primary" />{rating.toFixed(1)}</span>;
}
function ProductCard({ product, recommendation, onWishlist }: { product: Product; recommendation?: Recommendation; onWishlist?: (product: Product) => void }) {
  const { add } = useCart();
  const { isSignedIn } = useUser();
  const [added, setAdded] = useState(false);
  const addToCart = () => { add(product); setAdded(true); window.setTimeout(() => setAdded(false), 1200); };
  return <article className="group relative" data-testid={`card-product-${product.id}`}>
    <div className="relative overflow-hidden rounded-2xl bg-muted">
      <Link href={`/product/${product.id}`} data-testid={`link-product-${product.id}`}><img src={img(product)} alt={product.name} className="aspect-[.88] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" /></Link>
      {product.badge && <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">{product.badge}</span>}
      {recommendation && <span className="absolute bottom-3 left-3 rounded-full bg-foreground px-2.5 py-1 text-[10px] font-bold text-background">{Math.round(recommendation.score * 100)}% match</span>}
       <button onClick={() => { if (isSignedIn) onWishlist?.(product); else window.location.href = `${basePath}/sign-in`; }} aria-label={`Save ${product.name}`} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-background/90 text-foreground hover:scale-105" data-testid={`button-wishlist-${product.id}`}><Heart size={16} /></button>
      <button onClick={addToCart} disabled={product.stock <= 0} className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed disabled:bg-muted-foreground disabled:opacity-100" aria-label={`Add ${product.name} to cart`} data-testid={`button-add-${product.id}`}>{product.stock <= 0 ? <X size={16} /> : added ? <Check size={16} /> : <Plus size={16} />}</button>
    </div>
    <Link href={`/product/${product.id}`} className="mt-3 block" data-testid={`link-product-name-${product.id}`}><div className="flex items-start justify-between gap-2"><h3 className="text-sm font-bold leading-5">{product.name}</h3><span className="text-sm font-bold">{currency(product.price)}</span></div><div className="mt-1 flex items-center gap-2 text-muted-foreground"><span className="text-xs">{product.category}</span><Stars rating={product.rating} /></div></Link>
    {recommendation && <p className="mt-2 line-clamp-1 text-[11px] text-muted-foreground"><Sparkles size={11} className="mr-1 inline text-primary" />{recommendation.reason}</p>}
  </article>;
}

function CategoryRail({ categories }: { categories: Category[] }) {
  return <div className="flex gap-2 overflow-x-auto pb-1">{categories.map((category) => <Link href={`/shop?category=${category.slug}`} key={category.id} className="shrink-0 rounded-full border border-foreground/15 bg-card px-4 py-2 text-xs font-bold hover:border-primary hover:text-primary" data-testid={`link-category-${category.slug}`}>{category.name}<span className="ml-2 font-normal text-muted-foreground">{category.productCount}</span></Link>)}</div>;
}

function Home() {
  const [, setLocation] = useLocation();
  const { isSignedIn } = useUser();
  const categories = useListCategories();
  const products = useListProducts({ limit: 8, sort: 'featured' });
  const catalog = products.data || [];
  const recommendationSeed = catalog[0]?.id || 1;
  const recommendations = useGetProductRecommendations(recommendationSeed, { query: { queryKey: getGetProductRecommendationsQueryKey(recommendationSeed), enabled: catalog.length > 0 && isSignedIn === true } });
  const wishlistMutation = useToggleWishlist();
  const [savedNotice, setSavedNotice] = useState('');
  const recs = (recommendations.data || []) as Recommendation[];
  const toggle = (product: Product) => { wishlistMutation.mutate({ data: { customerId: CUSTOMER_ID, productId: product.id } }, { onSuccess: (result) => setSavedNotice(result.saved ? `${product.name} saved to your wishlist.` : `${product.name} removed from your wishlist.`) }); };
  return <div>
    <section className="mx-auto grid max-w-[1440px] gap-8 px-4 pb-14 pt-12 sm:px-8 lg:grid-cols-[1.12fr_.88fr] lg:items-center lg:gap-16 lg:pb-20 lg:pt-20">
      <div className="animate-rise-in"><p className="mono-font mb-6 text-xs uppercase tracking-[.25em] text-primary">A retail intelligence project</p><h1 className="display-font max-w-3xl text-[clamp(3.4rem,8vw,7.8rem)] font-bold leading-[.87]">Objects with<br /><span className="text-primary">a point of view.</span></h1><p className="mt-8 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">Find the things that make everyday life feel more like yours. Our recommendations are ranked by what fits, and always explain why.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/shop" className="inline-flex items-center gap-3 rounded-full bg-foreground px-6 py-3.5 text-sm font-bold text-background hover:-translate-y-0.5" data-testid="link-shop-hero">Shop the edit <ArrowRight size={16} /></Link><Link href="/#approach" className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-6 py-3.5 text-sm font-bold hover:border-foreground" data-testid="link-approach-hero">How it works</Link></div></div>
      <div className="relative min-h-[400px] overflow-hidden rounded-[2rem] bg-foreground p-5 text-background sm:min-h-[520px]"><div className="dot-grid absolute inset-0 opacity-30" /><div className="relative z-10 flex h-full min-h-[360px] flex-col justify-between sm:min-h-[480px]"><div className="flex items-center justify-between"><span className="mono-font text-[10px] uppercase tracking-[.25em] text-background/60">The current signal</span><span className="rounded-full border border-background/20 px-3 py-1 text-[10px] text-background/60">01 / 04</span></div><div><p className="display-font max-w-sm text-4xl font-semibold leading-[.94] sm:text-6xl">Small<br />rituals.<br /><span className="text-primary">Big reset.</span></p><div className="mt-7 flex items-end justify-between"><div><p className="text-sm font-semibold">The Sunday edit</p><p className="mt-1 text-xs text-background/55">For a slower, brighter morning.</p></div><Link href="/shop?category=home" className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground hover:rotate-[-8deg]" data-testid="link-hero-edit"><ArrowRight size={18} /></Link></div></div></div></div>
    </section>
    <section className="border-y border-foreground/10 bg-card/45"><div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-8"><CategoryRail categories={categories.data || []} /></div></section>
    <section className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 sm:py-24"><div className="mb-8 flex items-end justify-between"><div><p className="mono-font text-[10px] uppercase tracking-[.24em] text-primary">Selected for you</p><h2 className="display-font mt-2 text-4xl font-bold sm:text-5xl">The good stuff.</h2></div><Link href="/shop" className="hidden items-center gap-2 text-sm font-bold hover:text-primary sm:flex" data-testid="link-view-all">View all <ArrowRight size={15} /></Link></div>{products.isLoading ? <LoadingGrid count={4} /> : products.isError ? <QueryError onRetry={() => products.refetch()} /> : catalog.length ? <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-4 sm:gap-x-5">{catalog.slice(0, 8).map((product) => <ProductCard key={product.id} product={product} onWishlist={toggle} />)}</div> : <EmptyState title="The shelves are being restocked." detail="Check back soon for the next considered edit." />}</section>
    <section className="bg-accent/35 px-4 py-16 sm:px-8 sm:py-24" id="approach"><div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[.75fr_1.25fr] lg:items-end"><div><p className="mono-font text-[10px] uppercase tracking-[.24em] text-primary">The intelligence layer</p><h2 className="display-font mt-3 max-w-xl text-5xl font-bold leading-[.9] sm:text-7xl">Less scrolling.<br /><span className="text-primary">More finding.</span></h2></div><div className="grid gap-8 sm:grid-cols-3"><div><span className="mono-font text-3xl text-primary">01</span><h3 className="mt-5 font-bold">Browse by feeling</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Clear categories and honest product detail keep the choice yours.</p></div><div><span className="mono-font text-3xl text-primary">02</span><h3 className="mt-5 font-bold">See the signal</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">A ranked recommendation comes with the reason it belongs in your orbit.</p></div><div><span className="mono-font text-3xl text-primary">03</span><h3 className="mt-5 font-bold">Keep what works</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Wishlist favourites, revisit orders, and make your next choice faster.</p></div></div></div></section>
    <section className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 sm:py-24"><div className="mb-8 flex items-end justify-between"><div><p className="mono-font text-[10px] uppercase tracking-[.24em] text-primary">Because you looked closer</p><h2 className="display-font mt-2 text-4xl font-bold sm:text-5xl">A considered next.</h2></div><div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><Sparkles size={14} className="text-primary" /> Ranked recommendations</div></div>{recs.length ? <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-4 sm:gap-x-5">{recs.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} recommendation={product} onWishlist={toggle} />)}</div> : <div className="rounded-2xl bg-foreground p-8 text-background sm:p-12"><div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-end"><div><p className="mono-font text-xs uppercase tracking-[.2em] text-primary">Personal recommendations</p><h3 className="display-font mt-3 max-w-md text-4xl font-bold">Your next good choice is waiting.</h3></div><button onClick={() => setLocation('/shop')} className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" data-testid="button-start-browsing">Start browsing <ArrowRight size={15} /></button></div></div>}</section>
    {savedNotice && <ToastNotice message={savedNotice} onClose={() => setSavedNotice('')} />}
  </div>;
}

function Shop() {
  const [location, setLocation] = useLocation();
  const params = new URLSearchParams(location.split('?')[1] || '');
  const [search, setSearch] = useState(params.get('search') || '');
  const [category, setCategory] = useState(params.get('category') || '');
  const [sort, setSort] = useState<'featured' | 'price-low' | 'price-high' | 'rating' | 'popular' | 'newest'>('featured');
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [filterOpen, setFilterOpen] = useState(false);
  const categories = useListCategories();
  const products = useListProducts({ search: search || undefined, category: category || undefined, sort, minPrice: minPrice === '' ? undefined : minPrice, maxPrice: maxPrice === '' ? undefined : maxPrice, limit: 50 });
  const wishlistMutation = useToggleWishlist();
  const updateSearch = (value: string) => { setSearch(value); setLocation(`/shop${value ? `?search=${encodeURIComponent(value)}` : ''}`, { replace: true }); };
  return <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-8 sm:py-16"><div className="max-w-2xl"><p className="mono-font text-[10px] uppercase tracking-[.24em] text-primary">The catalog</p><h1 className="display-font mt-3 text-6xl font-bold leading-none sm:text-8xl">Find your<br /><span className="text-primary">next favourite.</span></h1></div><div className="mt-12 flex flex-col gap-4 border-y border-foreground/10 py-4 lg:flex-row lg:items-center lg:justify-between"><label className="flex h-12 flex-1 items-center gap-3 rounded-xl bg-card px-4 ring-1 ring-foreground/10 focus-within:ring-primary"><Search size={18} className="text-muted-foreground" /><input value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Search name, category, or description" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" data-testid="input-search-products" /><kbd className="hidden rounded bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground sm:block">⌘ K</kbd></label><button onClick={() => setFilterOpen(!filterOpen)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-foreground/15 px-4 text-sm font-bold lg:hidden" data-testid="button-mobile-filter"><SlidersHorizontal size={16} /> Filters</button><div className={`${filterOpen ? 'flex' : 'hidden'} flex-wrap gap-2 lg:flex`}><select value={category} onChange={(event) => setCategory(event.target.value)} className="h-12 rounded-xl border border-foreground/15 bg-transparent px-3 text-sm font-semibold outline-none" data-testid="select-category"><option value="">All categories</option>{(categories.data || []).map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="h-12 rounded-xl border border-foreground/15 bg-transparent px-3 text-sm font-semibold outline-none" data-testid="select-sort"><option value="featured">Featured</option><option value="popular">Most popular</option><option value="newest">Newest</option><option value="rating">Top rated</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select><input type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value === '' ? '' : Number(event.target.value))} placeholder="Min $" className="h-12 w-24 rounded-xl border border-foreground/15 bg-transparent px-3 text-sm outline-none" data-testid="input-min-price" /><input type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value === '' ? '' : Number(event.target.value))} placeholder="Max $" className="h-12 w-24 rounded-xl border border-foreground/15 bg-transparent px-3 text-sm outline-none" data-testid="input-max-price" /></div></div><div className="mt-8 flex items-center justify-between"><p className="text-sm text-muted-foreground"><span className="font-bold text-foreground">{products.data?.length || 0}</span> products found</p><div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span className="h-2 w-2 rounded-full bg-primary" /> Updated weekly</div></div><div className="mt-6">{products.isLoading ? <LoadingGrid count={8} /> : products.isError ? <QueryError onRetry={() => products.refetch()} /> : products.data?.length ? <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">{products.data.map((product) => <ProductCard key={product.id} product={product} onWishlist={(item) => wishlistMutation.mutate({ data: { customerId: CUSTOMER_ID, productId: item.id } })} />)}</div> : <EmptyState title="No products found." detail="Try a broader phrase or browse every category." />}</div></div>;
}

function ProductDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { isSignedIn } = useUser();
  const productQuery = useGetProduct(id);
  const recommendations = useGetProductRecommendations(id, { query: { queryKey: getGetProductRecommendationsQueryKey(id), enabled: isSignedIn === true } });
  const track = useTrackActivity();
  const wishlistMutation = useToggleWishlist();
  const { add } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  useEffect(() => { if (productQuery.data && isSignedIn) track.mutate({ data: { customerId: CUSTOMER_ID, productId: id, type: 'view' } }); }, [productQuery.data, id, isSignedIn]); // intentional view event
  if (productQuery.isLoading) return <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-8"><LoadingGrid count={2} /></div>;
  if (productQuery.isError || !productQuery.data) return <div className="mx-auto max-w-2xl px-4 py-20 sm:px-8"><QueryError onRetry={() => productQuery.refetch()} /></div>;
   const product = productQuery.data;
   const save = () => { if (!isSignedIn) { setLocation('/sign-in'); return; } wishlistMutation.mutate({ data: { customerId: CUSTOMER_ID, productId: product.id } }); };
   const buy = () => { if (product.stock <= 0) return; for (let i = 0; i < quantity; i += 1) add(product); setAdded(true); window.setTimeout(() => setAdded(false), 1500); };
   return <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-8 sm:py-16"><Link href="/shop" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground" data-testid="link-back-shop"><ChevronLeft size={16} /> Back to the edit</Link><div className="grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:gap-20"><div className="overflow-hidden rounded-[2rem] bg-muted"><img src={img(product)} alt={product.name} onError={(event) => { event.currentTarget.src = FALLBACK_IMAGES[0]; }} className="aspect-square w-full object-cover" /></div><div className="flex flex-col justify-center"><div className="flex items-center justify-between"><span className="mono-font text-[10px] uppercase tracking-[.2em] text-primary">{product.category}</span><button onClick={save} className="flex items-center gap-2 rounded-full border border-foreground/15 px-3 py-2 text-xs font-bold hover:border-primary hover:text-primary" data-testid={`button-detail-wishlist-${product.id}`}><Heart size={14} /> Save</button></div><h1 className="display-font mt-5 text-5xl font-bold leading-[.92] sm:text-7xl">{product.name}</h1><div className="mt-5 flex items-center gap-4"><span className="text-2xl font-bold">{currency(product.price)}</span>{product.compareAtPrice && <span className="text-sm text-muted-foreground line-through">{currency(product.compareAtPrice)}</span>}<Stars rating={product.rating} /><span className="text-xs text-muted-foreground">({product.reviewCount} reviews)</span></div><p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground">{product.description}</p><div className="mt-5 rounded-xl bg-muted px-4 py-3 text-sm font-semibold">{product.stock > 0 ? `${product.stock} available` : 'Currently out of stock'}</div><div className="mt-8 flex items-center gap-3"><div className="flex h-13 items-center rounded-full border border-foreground/15"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="grid h-12 w-11 place-items-center" aria-label="Decrease quantity" data-testid="button-decrease-quantity"><Minus size={15} /></button><span className="w-8 text-center text-sm font-bold" data-testid="text-product-quantity">{quantity}</span><button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} disabled={product.stock <= 0 || quantity >= product.stock} className="grid h-12 w-11 place-items-center disabled:opacity-40" aria-label="Increase quantity" data-testid="button-increase-quantity"><Plus size={15} /></button></div><button onClick={buy} disabled={product.stock <= 0} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-muted-foreground" data-testid="button-add-to-cart">{product.stock <= 0 ? 'Out of stock' : added ? <><Check size={16} /> Added to bag</> : <>Add to bag <ArrowRight size={16} /></>}</button></div><div className="mt-7 grid grid-cols-2 gap-3 border-t border-foreground/10 pt-6 text-xs"><div className="flex items-center gap-2"><Truck size={15} className="text-primary" /><span>Ships in 2–4 days</span></div><div className="flex items-center gap-2"><LockKeyhole size={15} className="text-primary" /><span>Secure checkout</span></div></div><div className="mt-7 flex flex-wrap gap-2">{product.tags.map((tag) => <span key={tag} className="rounded-full bg-muted px-3 py-1 text-[11px] font-semibold text-muted-foreground">#{tag}</span>)}</div></div></div><section className="mt-24 border-t border-foreground/10 pt-10"><div className="mb-7 flex items-end justify-between"><div><p className="mono-font text-[10px] uppercase tracking-[.2em] text-primary">Ranked around this</p><h2 className="display-font mt-2 text-4xl font-bold">You may also like.</h2></div><span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"><Sparkles size={14} className="text-primary" /> Transparent recommendations</span></div>{recommendations.isLoading ? <LoadingGrid count={5} /> : recommendations.isError ? <QueryError onRetry={() => recommendations.refetch()} /> : recommendations.data?.length ? <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-4 sm:gap-x-5">{recommendations.data.slice(0, 5).map((item) => <ProductCard key={item.id} product={item} recommendation={item} />)}</div> : <EmptyState title="No close matches yet." detail="Keep browsing to give the recommendation engine more signal." />}</section></div>;
}

function Cart() {
  const { items, total, setQuantity, remove, clear } = useCart();
  const [, setLocation] = useLocation();
  const createOrder = useCreateOrder();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [complete, setComplete] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'upi' | 'card'>('upi');
  const submit = () => createOrder.mutate({ data: { customerId: CUSTOMER_ID, items: items.map((line) => ({ productId: line.product.id, quantity: line.quantity })), paymentMethod } }, { onSuccess: (order) => { clear(); setComplete(order); } });
  if (complete) return <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-8"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-accent text-foreground"><Check size={32} /></div><p className="mono-font mt-8 text-xs uppercase tracking-[.25em] text-primary">Order confirmed</p><h1 className="display-font mt-3 text-6xl font-bold">Thank you.</h1><p className="mx-auto mt-5 max-w-md leading-7 text-muted-foreground">Order #{complete.id} is on its way into the world. We’ll keep you posted as it moves.</p><Link href="/account" className="mt-8 inline-flex rounded-full bg-foreground px-6 py-3 text-sm font-bold text-background" data-testid="link-view-order">View your orders</Link></div>;
   return <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-8 sm:py-16"><div className="flex items-end justify-between"><div><p className="mono-font text-[10px] uppercase tracking-[.24em] text-primary">Your bag</p><h1 className="display-font mt-3 text-6xl font-bold leading-none">Ready when<br /><span className="text-primary">you are.</span></h1></div><button onClick={clear} disabled={!items.length} className="text-xs font-bold text-muted-foreground underline underline-offset-4 disabled:opacity-40" data-testid="button-clear-cart">Clear bag</button></div>{items.length ? <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_360px]"><div className="divide-y divide-foreground/10 border-y border-foreground/10">{items.map((line) => <div className="flex gap-4 py-5 sm:gap-6" key={line.product.id} data-testid={`row-cart-${line.product.id}`}><img src={img(line.product)} alt={line.product.name} className="h-28 w-24 rounded-xl object-cover sm:h-36 sm:w-32" /><div className="flex min-w-0 flex-1 flex-col justify-between"><div className="flex justify-between gap-3"><div><p className="font-bold">{line.product.name}</p><p className="mt-1 text-xs text-muted-foreground">{line.product.category}</p></div><p className="font-bold">{currency(line.product.price * line.quantity)}</p></div><div className="flex items-center justify-between"><div className="flex items-center rounded-full border border-foreground/15"><button onClick={() => setQuantity(line.product.id, line.quantity - 1)} className="grid h-8 w-8 place-items-center" aria-label="Decrease cart quantity" data-testid={`button-cart-minus-${line.product.id}`}><Minus size={13} /></button><span className="w-7 text-center text-xs font-bold">{line.quantity}</span><button onClick={() => setQuantity(line.product.id, line.quantity + 1)} className="grid h-8 w-8 place-items-center" aria-label="Increase cart quantity" data-testid={`button-cart-plus-${line.product.id}`}><Plus size={13} /></button></div><button onClick={() => remove(line.product.id)} className="text-xs font-bold text-muted-foreground hover:text-destructive" data-testid={`button-remove-${line.product.id}`}>Remove</button></div></div></div>)}</div><aside className="h-fit rounded-2xl bg-foreground p-6 text-background sm:p-8"><p className="mono-font text-[10px] uppercase tracking-[.22em] text-background/55">Summary</p><div className="mt-7 flex justify-between text-sm text-background/70"><span>Subtotal</span><span>{currency(total)}</span></div><div className="mt-3 flex justify-between text-sm text-background/70"><span>Delivery</span><span>{total >= 75 ? 'Free' : currency(8)}</span></div><div className="my-6 border-t border-background/15 pt-5"><div className="flex justify-between text-lg font-bold"><span>Total</span><span>{currency(total >= 75 ? total : total + 8)}</span></div></div><button onClick={() => setCheckoutOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-bold text-primary-foreground" data-testid="button-checkout">Continue to checkout <ArrowRight size={16} /></button><button onClick={() => setLocation('/shop')} className="mt-4 w-full py-2 text-xs font-bold text-background/60 hover:text-background" data-testid="button-continue-shopping">Continue shopping</button></aside></div> : <div className="mt-12"><EmptyState title="Your bag is taking a quiet moment." detail="Add something considered from the shop and it will appear here." /><div className="mt-6 text-center"><Link href="/shop" className="inline-flex rounded-full bg-foreground px-6 py-3 text-sm font-bold text-background" data-testid="link-empty-shop">Browse the edit</Link></div></div>}{checkoutOpen && <CheckoutModal onClose={() => setCheckoutOpen(false)} onSubmit={submit} pending={createOrder.isPending} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} />}</div>;
}

function CheckoutModal({ onClose, onSubmit, pending, paymentMethod, setPaymentMethod }: { onClose: () => void; onSubmit: () => void; pending: boolean; paymentMethod: 'cod' | 'upi' | 'card'; setPaymentMethod: (method: 'cod' | 'upi' | 'card') => void }) {
  const [upiId, setUpiId] = useState('');
  return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/55 p-4"><form className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl sm:p-8" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><div className="flex items-start justify-between"><div><p className="mono-font text-[10px] uppercase tracking-[.2em] text-primary">Final step</p><h2 className="display-font mt-2 text-4xl font-bold">Checkout</h2></div><button type="button" onClick={onClose} aria-label="Close checkout" data-testid="button-close-checkout"><X /></button></div><div className="mt-7 grid gap-4"><label className="text-xs font-bold">Email<input defaultValue="alex@example.com" type="email" className="mt-2 h-12 w-full rounded-xl border border-foreground/15 bg-background px-4 text-sm outline-none focus:border-primary" data-testid="input-checkout-email" /></label><label className="text-xs font-bold">Shipping address<input placeholder="24 Market Street" className="mt-2 h-12 w-full rounded-xl border border-foreground/15 bg-background px-4 text-sm outline-none focus:border-primary" data-testid="input-checkout-address" /></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold">City<input placeholder="San Francisco" className="mt-2 h-12 w-full rounded-xl border border-foreground/15 bg-background px-4 text-sm outline-none focus:border-primary" data-testid="input-checkout-city" /></label><label className="text-xs font-bold">Postcode<input placeholder="94103" className="mt-2 h-12 w-full rounded-xl border border-foreground/15 bg-background px-4 text-sm outline-none focus:border-primary" data-testid="input-checkout-postcode" /></label></div><fieldset><legend className="text-xs font-bold">Payment method</legend><div className="mt-2 grid grid-cols-3 gap-2">{(['upi', 'card', 'cod'] as const).map((method) => <label key={method} className="cursor-pointer rounded-xl border border-foreground/15 p-3 text-center text-xs font-bold has-[:checked]:border-primary has-[:checked]:bg-primary/10"><input type="radio" name="payment-method" value={method} checked={paymentMethod === method} onChange={() => setPaymentMethod(method)} className="sr-only" />{method === 'upi' ? 'UPI' : method === 'card' ? 'Card' : 'Cash on delivery'}</label>)}</div></fieldset>{paymentMethod === 'upi' && <label className="text-xs font-bold">UPI ID<input required value={upiId} onChange={(event) => setUpiId(event.target.value)} placeholder="yourname@upi" className="mt-2 h-12 w-full rounded-xl border border-foreground/15 bg-background px-4 text-sm outline-none focus:border-primary" data-testid="input-upi-id" /></label>}</div><div className="mt-8 flex items-center justify-between border-t border-foreground/10 pt-5"><span className="text-xs text-muted-foreground">Demo payment · no charge collected</span><button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60" data-testid="button-place-order">{pending && <Loader2 size={15} className="animate-spin" />} Place order <ArrowRight size={15} /></button></div></form></div>;
}

function Account() {
  const profile = useGetCustomerProfile(CUSTOMER_ID);
  const wishlist = useGetWishlist(CUSTOMER_ID);
  const orders = useListOrders({ customerId: CUSTOMER_ID });
  const toggle = useToggleWishlist();
  return <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-8 sm:py-16"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mono-font text-[10px] uppercase tracking-[.24em] text-primary">Your space</p><h1 className="display-font mt-3 text-6xl font-bold leading-none">Hello, <span className="text-primary">{profile.data?.name?.split(' ')[0] || 'there'}.</span></h1></div><Link href="/shop" className="inline-flex w-fit items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-bold text-background" data-testid="link-account-shop">Keep browsing <ArrowRight size={15} /></Link></div>{profile.isLoading ? <div className="mt-12 grid gap-4 sm:grid-cols-3"><div className="skeleton-sheen h-32 rounded-2xl" /><div className="skeleton-sheen h-32 rounded-2xl" /><div className="skeleton-sheen h-32 rounded-2xl" /></div> : profile.isError ? <div className="mt-10"><QueryError onRetry={() => profile.refetch()} /></div> : <div className="mt-12 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-foreground p-6 text-background"><p className="mono-font text-[10px] uppercase tracking-[.2em] text-background/50">Customer segment</p><p className="mt-5 text-2xl font-bold">{profile.data?.segment || 'Explorer'}</p><p className="mt-2 text-xs text-background/55">Since {profile.data?.joinedAt ? formatDate(profile.data.joinedAt) : 'this season'}</p></div><div className="rounded-2xl border border-foreground/10 bg-card p-6"><p className="mono-font text-[10px] uppercase tracking-[.2em] text-muted-foreground">Lifetime spend</p><p className="mt-5 text-3xl font-bold">{currency(profile.data?.totalSpent || 0)}</p><p className="mt-2 text-xs text-muted-foreground">{profile.data?.orderCount || 0} orders placed</p></div><div className="rounded-2xl border border-foreground/10 bg-card p-6"><p className="mono-font text-[10px] uppercase tracking-[.2em] text-muted-foreground">Saved objects</p><p className="mt-5 text-3xl font-bold">{profile.data?.wishlistCount || wishlist.data?.length || 0}</p><p className="mt-2 text-xs text-muted-foreground">For later consideration</p></div></div>}<div className="mt-16 grid gap-16 lg:grid-cols-[1fr_1fr]"><section><div className="mb-7 flex items-end justify-between"><div><p className="mono-font text-[10px] uppercase tracking-[.2em] text-primary">Your shortlist</p><h2 className="display-font mt-2 text-4xl font-bold">Wishlist.</h2></div><Heart size={22} className="text-primary" /></div>{wishlist.isLoading ? <LoadingGrid count={2} /> : wishlist.isError ? <QueryError onRetry={() => wishlist.refetch()} /> : wishlist.data?.length ? <div className="grid grid-cols-2 gap-3">{wishlist.data.map((product) => <ProductCard key={product.id} product={product} onWishlist={(item) => toggle.mutate({ data: { customerId: CUSTOMER_ID, productId: item.id } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetWishlistQueryKey(CUSTOMER_ID) }) })} />)}</div> : <EmptyState title="Nothing saved yet." detail="Tap the heart on any object you want to revisit." />}</section><section><div className="mb-7 flex items-end justify-between"><div><p className="mono-font text-[10px] uppercase tracking-[.2em] text-primary">The paper trail</p><h2 className="display-font mt-2 text-4xl font-bold">Order history.</h2></div><Package size={22} className="text-primary" /></div>{orders.isLoading ? <div className="space-y-3">{[1, 2].map((item) => <div key={item} className="skeleton-sheen h-24 rounded-2xl" />)}</div> : orders.isError ? <QueryError onRetry={() => orders.refetch()} /> : orders.data?.length ? <div className="space-y-3">{orders.data.map((order) => <div key={order.id} className="rounded-2xl border border-foreground/10 bg-card p-5" data-testid={`row-order-${order.id}`}><div className="flex items-center justify-between"><div><p className="text-sm font-bold">Order #{order.id}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(order.placedAt)} · {order.items.length} {order.items.length === 1 ? 'item' : 'items'}</p></div><span className="rounded-full bg-accent/50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">{order.status}</span></div><div className="mt-4 flex items-center justify-between border-t border-foreground/10 pt-3"><p className="text-xs text-muted-foreground">{order.items.map((item) => item.productName).join(', ')}</p><p className="font-bold">{currency(order.total)}</p></div></div>)}</div> : <EmptyState title="No orders yet." detail="Your next favourite is waiting in the shop." />}</section></div></div>;
}

function Admin() {
  const dashboard = useGetAnalyticsDashboard();
  const activity = useGetRecentActivity({ limit: 8 });
  if (dashboard.isLoading) return <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-8"><div className="skeleton-sheen h-40 rounded-3xl" /><div className="mt-6 grid gap-4 sm:grid-cols-4">{[1, 2, 3, 4].map((item) => <div className="skeleton-sheen h-28 rounded-2xl" key={item} />)}</div></div>;
  if (dashboard.isError || !dashboard.data) return <div className="mx-auto max-w-xl px-4 py-20 sm:px-8"><QueryError onRetry={() => dashboard.refetch()} /></div>;
  return <AnalyticsView dashboard={dashboard.data} activity={activity.data || []} activityLoading={activity.isLoading} />;
}
function AnalyticsView({ dashboard, activity, activityLoading }: { dashboard: AnalyticsDashboard; activity: { id: number; customerName: string; productName: string; type: string; occurredAt: string }[]; activityLoading: boolean }) {
  const maxRevenue = Math.max(...dashboard.monthlyRevenue.map((item) => item.value), 1);
  return <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-8 sm:py-16"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="mono-font text-[10px] uppercase tracking-[.24em] text-primary">Decision room</p><h1 className="display-font mt-3 text-6xl font-bold leading-none">Commerce,<br /><span className="text-primary">with context.</span></h1></div><div className="rounded-full border border-foreground/15 px-4 py-2 text-xs font-semibold"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent" />Live storefront signal</div></div><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{dashboard.metrics.map((metric) => <div key={metric.label} className="rounded-2xl border border-foreground/10 bg-card p-6"><p className="text-xs font-semibold text-muted-foreground">{metric.label}</p><p className="display-font mt-5 text-4xl font-bold">{metric.label.toLowerCase().includes('revenue') || metric.label.toLowerCase().includes('value') ? currency(metric.value) : metric.value.toLocaleString()}</p><p className={`mt-2 text-xs font-bold ${metric.change >= 0 ? 'text-accent-foreground' : 'text-destructive'}`}><TrendingUp size={13} className="mr-1 inline" />{metric.change >= 0 ? '+' : ''}{metric.change.toFixed(1)}% vs prior period</p></div>)}</div><div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_.65fr]"><section className="rounded-3xl bg-foreground p-6 text-background sm:p-8"><div className="flex items-start justify-between"><div><p className="mono-font text-[10px] uppercase tracking-[.2em] text-background/50">Monthly revenue</p><h2 className="display-font mt-2 text-3xl font-bold">The trajectory.</h2></div><BarChart3 className="text-primary" /></div><div className="mt-10 flex h-52 items-end gap-2 sm:gap-4">{dashboard.monthlyRevenue.map((point) => <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-2"><div className="relative flex h-40 w-full items-end"><div className="w-full rounded-t-lg bg-primary transition-all hover:bg-secondary" style={{ height: `${Math.max((point.value / maxRevenue) * 100, 5)}%` }} title={`${point.label}: ${currency(point.value)}`} /></div><span className="mono-font truncate text-[9px] text-background/50">{point.label}</span></div>)}</div></section><section className="rounded-3xl border border-foreground/10 bg-card p-6 sm:p-8"><p className="mono-font text-[10px] uppercase tracking-[.2em] text-primary">Customer segments</p><h2 className="display-font mt-2 text-3xl font-bold">Who’s here.</h2><div className="mt-8 space-y-5">{dashboard.segments.map((segment, index) => <div key={segment.label}><div className="mb-2 flex justify-between text-xs font-bold"><span>{segment.label}</span><span>{segment.value}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${index % 2 ? 'bg-secondary' : 'bg-primary'}`} style={{ width: `${Math.min(segment.value, 100)}%` }} /></div></div>)}</div></section></div><div className="mt-8 grid gap-8 lg:grid-cols-2"><section className="rounded-3xl border border-foreground/10 bg-card p-6 sm:p-8"><p className="mono-font text-[10px] uppercase tracking-[.2em] text-primary">Top products</p><h2 className="display-font mt-2 text-3xl font-bold">What moves.</h2><div className="mt-7 space-y-4">{dashboard.topProducts.map((item, index) => <div key={item.label} className="flex items-center gap-4"><span className="mono-font w-5 text-xs text-muted-foreground">0{index + 1}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min((item.value / Math.max(...dashboard.topProducts.map((entry) => entry.value), 1)) * 100, 100)}%` }} /></div><span className="w-32 truncate text-right text-xs font-bold">{item.label}</span></div>)}</div></section><section className="rounded-3xl border border-foreground/10 bg-card p-6 sm:p-8"><div className="flex items-center justify-between"><div><p className="mono-font text-[10px] uppercase tracking-[.2em] text-primary">Recent activity</p><h2 className="display-font mt-2 text-3xl font-bold">The live pulse.</h2></div><span className="rounded-full bg-accent/45 px-3 py-1 text-[10px] font-bold uppercase">Last 8</span></div>{activityLoading ? <div className="mt-7 space-y-3">{[1, 2, 3].map((item) => <div className="skeleton-sheen h-9 rounded" key={item} />)}</div> : activity.length ? <div className="mt-7 space-y-4">{activity.slice(0, 5).map((event) => <div className="flex items-start gap-3" key={event.id}><div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-primary">{event.type === 'purchase' ? <ShoppingBag size={13} /> : event.type === 'like' ? <Heart size={13} /> : <Search size={13} />}</div><div className="min-w-0 text-xs"><p><span className="font-bold">{event.customerName}</span> {event.type === 'purchase' ? 'purchased' : event.type === 'like' ? 'saved' : 'viewed'} <span className="font-bold">{event.productName}</span></p><p className="mt-1 text-muted-foreground">{formatDate(event.occurredAt)}</p></div></div>)}</div> : <p className="mt-7 text-sm text-muted-foreground">Activity will appear as customers browse.</p>}</section></div></div>;
}

function SignInPage() {
  return <div className="flex min-h-[calc(100dvh-77px)] items-center justify-center bg-background px-4 py-10"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}

function SignUpPage() {
  return <div className="flex min-h-[calc(100dvh-77px)] items-center justify-center bg-background px-4 py-10"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

function ToastNotice({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const timer = window.setTimeout(onClose, 3000); return () => window.clearTimeout(timer); }, [onClose]);
  return <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-xl"><Check size={15} className="text-primary" />{message}<button onClick={onClose} aria-label="Dismiss notification" data-testid="button-dismiss-notice"><X size={14} /></button></div>;
}

function ProtectedPage({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <div className="mx-auto max-w-xl px-4 py-20 sm:px-8"><div className="skeleton-sheen h-40 rounded-3xl" /></div>;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <>{children}</>;
}

function AdminPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const isAdmin = user?.publicMetadata?.role === 'admin' || user?.publicMetadata?.isAdmin === true;
  if (!isLoaded) return <div className="mx-auto max-w-xl px-4 py-20 sm:px-8"><div className="skeleton-sheen h-40 rounded-3xl" /></div>;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (!isAdmin) return <NotFound />;
  return <Admin />;
}

function Router() {
  return <ErrorBoundary resetKey={window.location.pathname}><Switch><Route path="/sign-in/*?" component={SignInPage} /><Route path="/sign-up/*?" component={SignUpPage} /><Route path="/login"><Redirect to="/sign-in" /></Route><Route path="/register"><Redirect to="/sign-up" /></Route><Route><Shell><Switch><Route path="/" component={Home} /><Route path="/shop" component={Shop} /><Route path="/product/:id" component={ProductDetail} /><Route path="/cart"><ProtectedPage><Cart /></ProtectedPage></Route><Route path="/account"><ProtectedPage><Account /></ProtectedPage></Route><Route path="/admin" component={AdminPage} /><Route component={NotFound} /></Switch></Shell></Route></Switch></ErrorBoundary>;
}
function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}><QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><CartProvider><Router /></CartProvider></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider></ClerkProvider>;
}
export default App;