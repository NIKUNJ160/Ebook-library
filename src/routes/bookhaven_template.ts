export function renderBookHaven(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BookHaven — Social eBook Collection & Community</title>
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&family=Open+Sans:wght@300;400;600;700&family=Roboto:wght@300;400;700&display=swap" rel="stylesheet">
    <!-- FontAwesome Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script>
        (function() {
            const saved = localStorage.getItem('theme');
            if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        })();
    </script>
    <!-- Tailwind CSS Play CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        brand: {
                            50: '#fff5f0',
                            100: '#ffe3d5',
                            200: '#ffc4aa',
                            300: '#ff9c74',
                            400: '#ff6b37',
                            500: '#ff530d',
                            600: '#f03c00',
                            700: '#cc2d00',
                            800: '#a32503',
                            900: '#822007',
                            950: '#470d01',
                        },
                        slate: {
                            50: 'var(--slate-50)',
                            100: 'var(--slate-100)',
                            200: 'var(--slate-200)',
                            300: 'var(--slate-300)',
                            400: 'var(--slate-400)',
                            500: 'var(--slate-500)',
                            600: 'var(--slate-600)',
                            700: 'var(--slate-700)',
                            800: 'var(--slate-800)',
                            850: 'var(--slate-850)',
                            900: 'var(--slate-900)',
                            950: 'var(--slate-950)'
                        }
                    },
                    fontFamily: {
                        sans: ['Open Sans', 'sans-serif'],
                        outfit: ['Outfit', 'sans-serif'],
                        roboto: ['Roboto', 'sans-serif']
                    }
                }
            }
        }
    </script>
    <style>
        :root {
            --slate-50: #000000;
            --slate-100: #222222;
            --slate-200: #333333;
            --slate-300: #555555;
            --slate-400: #666666;
            --slate-500: #888888;
            --slate-600: #777777;
            --slate-700: #cbd5e1;
            --slate-800: #e8e8e8;
            --slate-850: #f4f4f4;
            --slate-900: #ffffff;
            --slate-950: #e9eaed;

            --glass-card-bg: rgba(255, 255, 255, 0.95);
            --glass-card-border: rgba(0, 0, 0, 0.08);
            --glass-nav-bg: rgba(255, 255, 255, 0.95);
        }
        .dark {
            --slate-50: #ffffff;
            --slate-100: #f8fafc;
            --slate-200: #d0d0d0;
            --slate-300: #cbd5e1;
            --slate-400: #94a3b8;
            --slate-500: #64748b;
            --slate-600: #475569;
            --slate-700: #334155;
            --slate-800: #2b2b2b;
            --slate-850: #2c2c2c;
            --slate-900: #3e3e3e;
            --slate-950: #5a5454;

            --glass-card-bg: rgba(62, 62, 62, 0.95);
            --glass-card-border: rgba(255, 255, 255, 0.08);
            --glass-nav-bg: rgba(62, 62, 62, 0.95);
        }
        body {
            background-color: var(--slate-950);
            color: var(--slate-200);
            font-family: 'Open Sans', sans-serif;
            overflow-x: hidden;
        }
        /* Custom scrollbar */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        ::-webkit-scrollbar-track {
            background: var(--slate-950);
        }
        ::-webkit-scrollbar-thumb {
            background: var(--slate-700);
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: var(--slate-600);
        }
        /* Glassmorphism classes */
        .glass-card {
            background: var(--glass-card-bg);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid var(--glass-card-border);
        }
        .glass-nav {
            background: var(--glass-nav-bg);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-bottom: 1px solid var(--glass-card-border);
        }
        /* Active status indicator */
        .online-dot {
            position: relative;
        }
        .online-dot::after {
            content: '';
            position: absolute;
            bottom: 0;
            right: 0;
            width: 10px;
            height: 10px;
            background-color: #22c55e;
            border: 2px solid var(--slate-900);
            border-radius: 50%;
        }
    </style>
    <!-- Load React & ReactDOM -->
    <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
    <!-- Load Babel for live compilation of JSX -->
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body class="min-h-screen flex flex-col">
    <!-- Offline Indicator -->
    <div id="offline-banner" class="hidden bg-amber-600 text-white text-center py-2 px-4 text-sm font-semibold sticky top-0 z-50 flex items-center justify-center gap-2">
        <i class="fas fa-wifi-slash"></i>
        <span>Offline Mode Enabled - Serving Cached Book Data</span>
    </div>

    <!-- React Mounting Point -->
    <div id="root" class="flex-grow flex flex-col"></div>

    <!-- React App Script (JSX) -->
    <script type="text/babel">
        const { useState, useEffect, useRef } = React;

        // Custom state storage to handle mock sessions locally when offline
        const getStoredAuth = () => {
            const token = localStorage.getItem('bh_token');
            const user = localStorage.getItem('bh_user');
            return token && user ? { token, user: JSON.parse(user) } : null;
        };

        function App() {
            const [isDarkMode, setIsDarkMode] = useState(() => {
                const saved = localStorage.getItem('theme');
                return saved ? saved === 'dark' : false;
            });

            useEffect(() => {
                const root = document.documentElement;
                if (isDarkMode) {
                    root.classList.add('dark');
                    localStorage.setItem('theme', 'dark');
                } else {
                    root.classList.remove('dark');
                    localStorage.setItem('theme', 'light');
                }
            }, [isDarkMode]);

            const toggleTheme = () => {
                setIsDarkMode(!isDarkMode);
            };

            const [auth, setAuth] = useState(getStoredAuth());
            const [activeTab, setActiveTab] = useState('home');
            const [ageGroup, setAgeGroup] = useState(auth?.user?.age_group || 'ya');
            const [wallet, setWallet] = useState({ balance: 0, transactions: [] });
            const [library, setLibrary] = useState([]);
            const [catalogue, setCatalogue] = useState([]);
            const [suggestions, setSuggestions] = useState([]);
            const [feed, setFeed] = useState([]);
            const [challenges, setChallenges] = useState([]);
            const [clubs, setClubs] = useState([]);
            const [forumThreads, setForumThreads] = useState([]);
            const [marketplace, setMarketplace] = useState([]);
            const [isLoading, setIsLoading] = useState(true);
            
            // For detail views
            const [activeThread, setActiveThread] = useState(null);
            const [activeClubRoom, setActiveClubRoom] = useState(null);
            
            // Search / filter query
            const [searchQuery, setSearchQuery] = useState('');
            const [filterStatus, setFilterStatus] = useState('all'); // all, reading, want_to_read, finished
            
            // Manga filters
            const [mangaGenre, setMangaGenre] = useState('all');
            const [mangaTag, setMangaTag] = useState('all');
            const [mangaAuthor, setMangaAuthor] = useState('all');
            const [mangaSearch, setMangaSearch] = useState('');
            const [currentSlide, setCurrentSlide] = useState(0);
            const [selectedBook, setSelectedBook] = useState(null);

            
            // Modals
            const [showAuthModal, setShowAuthModal] = useState(!auth);
            const [authMode, setAuthMode] = useState('login'); // login, register
            const [showCreateClubModal, setShowCreateClubModal] = useState(false);
            const [showCreateThreadModal, setShowCreateThreadModal] = useState(false);
            const [showNotifications, setShowNotifications] = useState(false);
            
            // Form states
            const [authIdentifier, setAuthIdentifier] = useState('');

            const [regUsername, setRegUsername] = useState('');
            const [regAgeGroup, setRegAgeGroup] = useState('ya');

            const [clubName, setClubName] = useState('');
            const [clubDesc, setClubDesc] = useState('');
            const [clubTime, setClubTime] = useState('');
            const [threadTitle, setThreadTitle] = useState('');
            const [threadContent, setThreadContent] = useState('');
            const [replyContent, setReplyContent] = useState('');
            const [errorMsg, setErrorMsg] = useState('');
            
            // Offline check
            const [isOffline, setIsOffline] = useState(!navigator.onLine);

            useEffect(() => {
                const handleOnline = () => {
                    setIsOffline(false);
                    document.getElementById('offline-banner').classList.add('hidden');
                };
                const handleOffline = () => {
                    setIsOffline(true);
                    document.getElementById('offline-banner').classList.remove('hidden');
                };
                window.addEventListener('online', handleOnline);
                window.addEventListener('offline', handleOffline);
                
                // Initialize if offline originally
                if (!navigator.onLine) handleOffline();

                return () => {
                    window.removeEventListener('online', handleOnline);
                    window.removeEventListener('offline', handleOffline);
                };
            }, []);

            // Helper for API fetch
            const apiFetch = async (url, options = {}) => {
                const headers = {
                    'Content-Type': 'application/json',
                    ...(auth ? { 'Authorization': 'Bearer ' + auth.token } : {}),
                    ...options.headers
                };
                
                try {
                    const response = await fetch(url, { ...options, headers });
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Request failed');
                    }
                    return await response.json();
                } catch (err) {
                    console.error('API Error:', err);
                    if (isOffline) {
                        // Fallback data loading from localStorage when offline
                        const cacheKey = \`offline_\${url}\`;
                        const cached = localStorage.getItem(cacheKey);
                        if (cached) return JSON.parse(cached);
                    }
                    throw err;
                }
            };

            // Fetch app data
            const loadData = async () => {
                if (!auth) return;
                setIsLoading(true);
                try {
                    // Load in parallel
                    const [libData, catData, sugData, feedData, challengeData, clubData, forumData] = await Promise.all([
                        apiFetch('/api/books/library'),
                        apiFetch(\`/api/books/catalogue?category=\${ageGroup}\`),
                        apiFetch('/api/books/suggestions'),
                        apiFetch('/api/books/feed'),
                        apiFetch('/api/books/challenges'),
                        apiFetch(\`/api/books/clubs?category=\${ageGroup}\`),
                        apiFetch(\`/api/books/forum?category=\${ageGroup}\`)
                    ]);

                    setLibrary(libData);
                    setCatalogue(catData);
                    setSuggestions(sugData);
                    setFeed(feedData);
                    setChallenges(challengeData);
                    setClubs(clubData);
                    setForumThreads(forumData);

                    // Cache offline data
                    localStorage.setItem('offline_/api/books/library', JSON.stringify(libData));
                    localStorage.setItem(\`offline_/api/books/catalogue?category=\${ageGroup}\`, JSON.stringify(catData));
                } catch (err) {
                    console.error('Failed to load data', err);
                } finally {
                    setIsLoading(false);
                }
            };

            useEffect(() => {
                if (auth) {
                    loadData();
                }
            }, [auth, ageGroup]);

            // Automatically seed catalog on mount
            useEffect(() => {
                fetch('/api/books/seed', { method: 'POST' })
                    .then(() => fetch('/api/books/challenges/seed', { method: 'POST' }))
                    .then(() => {
                        if (auth) loadData();
                    })
                    .catch(console.error);
            }, []);

            // Auto advance carousel slider every 5 seconds
            useEffect(() => {
                if (suggestions.length === 0) return;
                const timer = setInterval(() => {
                    setCurrentSlide(prev => (prev + 1) % Math.min(suggestions.length, 5));
                }, 5000);
                return () => clearInterval(timer);
            }, [suggestions]);

            const handleLogout = () => {
                localStorage.removeItem('bh_token');
                localStorage.removeItem('bh_user');
                setAuth(null);
                setShowAuthModal(true);
            };            // Authentication Handler
            const [otpLoading, setOtpLoading] = useState(false);

            const handleAuthSubmit = async (e) => {
                e.preventDefault();
                setErrorMsg('');
                if (!authIdentifier) {
                    setErrorMsg('Identifier is required');
                    return;
                }
                
                setOtpLoading(true);
                try {
                    if (authMode === 'login') {
                        const res = await apiFetch('/api/books/auth/login', {
                            method: 'POST',
                            body: JSON.stringify({ identifier: authIdentifier })
                        });
                        if (res.success) {
                            localStorage.setItem('bh_token', res.token);
                            localStorage.setItem('bh_user', JSON.stringify(res.user));
                            setAuth({ token: res.token, user: res.user });
                            setAgeGroup(res.user.age_group);
                            setShowAuthModal(false);
                            setAuthIdentifier('');
                        }
                    } else if (authMode === 'register') {
                        if (!regUsername) {
                            setErrorMsg('Username is required');
                            setOtpLoading(false);
                            return;
                        }
                        const res = await apiFetch('/api/books/auth/register', {
                            method: 'POST',
                            body: JSON.stringify({
                                username: regUsername,
                                identifier: authIdentifier,
                                age_group: regAgeGroup
                            })
                        });
                        if (res.success) {
                            localStorage.setItem('bh_token', res.token);
                            localStorage.setItem('bh_user', JSON.stringify(res.user));
                            setAuth({ token: res.token, user: res.user });
                            setAgeGroup(res.user.age_group);
                            setShowAuthModal(false);
                            setAuthIdentifier('');
                            setRegUsername('');
                        }
                    }
                } catch (err) {
                    setErrorMsg(err.message || 'Authentication failed');
                } finally {
                    setOtpLoading(false);
                }
            };

            // Update user progress percentage
            const updateProgress = async (bookId, percent, status = 'reading') => {
                try {
                    await apiFetch('/api/books/library/progress', {
                        method: 'POST',
                        body: JSON.stringify({ book_id: bookId, progress: percent, status })
                    });
                    loadData();
                } catch (err) {
                    console.error('Failed to update progress', err);
                }
            };

            // Save review & quote
            const saveReviewQuote = async (bookId, reviewText, quoteText, rating) => {
                try {
                    await apiFetch('/api/books/library/progress', {
                        method: 'POST',
                        body: JSON.stringify({
                            book_id: bookId,
                            rating,
                            favorite_quote: quoteText,
                            review_text: reviewText
                        })
                    });
                    loadData();
                } catch (err) {
                    console.error('Failed to save review/quote', err);
                }
            };

            // Add book to personal library
            const addToLibrary = async (bookId) => {
                try {
                    await apiFetch('/api/books/library/add', {
                        method: 'POST',
                        body: JSON.stringify({ book_id: bookId })
                    });
                    loadData();
                    setActiveTab('library');
                } catch (err) {
                    console.error('Failed to add book', err);
                }
            };

            // Join reading challenge
            const joinChallenge = async (challengeId) => {
                try {
                    await apiFetch('/api/books/challenges/join', {
                        method: 'POST',
                        body: JSON.stringify({ challenge_id: challengeId })
                    });
                    loadData();
                } catch (err) {
                    console.error('Failed to join challenge', err);
                }
            };

            // Virtual Wallet Top-Up
            const handleTopup = async (e) => {
                e.preventDefault();
                const amount = parseFloat(topupAmount);
                if (isNaN(amount) || amount <= 0) return;
                try {
                    const res = await apiFetch('/api/books/wallet/topup', {
                        method: 'POST',
                        body: JSON.stringify({ amount })
                    });
                    setWallet(prev => ({
                        ...prev,
                        balance: res.balance
                    }));
                    setShowTopupModal(false);
                    loadData();
                } catch (err) {
                    console.error('Failed to topup wallet', err);
                }
            };

            // Marketplace Buy
            const buyMarketplaceBook = async (listingId) => {
                try {
                    const res = await apiFetch('/api/books/marketplace/buy', {
                        method: 'POST',
                        body: JSON.stringify({ listing_id: listingId })
                    });
                    setWallet(prev => ({ ...prev, balance: res.balance }));
                    loadData();
                    setActiveTab('library');
                    alert('Book purchased successfully with virtual wallet balance!');
                } catch (err) {
                    alert(err.message || 'Purchase failed');
                }
            };

            // Marketplace List New Book
            const handleCreateListing = async (e) => {
                e.preventDefault();
                const priceVal = parseFloat(listPrice);
                if (!listTitle || !listAuthor || isNaN(priceVal)) return;
                try {
                    await apiFetch('/api/books/marketplace/list', {
                        method: 'POST',
                        body: JSON.stringify({
                            title: listTitle,
                            author: listAuthor,
                            description: listDesc,
                            price: priceVal,
                            listing_type: listType
                        })
                    });
                    setShowCreateListingModal(false);
                    setListTitle('');
                    setListAuthor('');
                    setListPrice('');
                    setListDesc('');
                    loadData();
                } catch (err) {
                    console.error('Failed to create listing', err);
                }
            };

            // Book Club Create
            const handleCreateClub = async (e) => {
                e.preventDefault();
                if (!clubName) return;
                try {
                    await apiFetch('/api/books/clubs', {
                        method: 'POST',
                        body: JSON.stringify({
                            name: clubName,
                            description: clubDesc,
                            category: ageGroup,
                            meeting_time: clubTime
                        })
                    });
                    setShowCreateClubModal(false);
                    setClubName('');
                    setClubDesc('');
                    setClubTime('');
                    loadData();
                } catch (err) {
                    console.error('Failed to create book club', err);
                }
            };

            // Thread Creation
            const handleCreateThread = async (e) => {
                e.preventDefault();
                if (!threadTitle || !threadContent) return;
                try {
                    await apiFetch('/api/books/forum', {
                        method: 'POST',
                        body: JSON.stringify({
                            title: threadTitle,
                            content: threadContent,
                            category: ageGroup
                        })
                    });
                    setShowCreateThreadModal(false);
                    setThreadTitle('');
                    setThreadContent('');
                    loadData();
                } catch (err) {
                    console.error('Failed to create thread', err);
                }
            };

            // Forum Thread Details Fetch
            const viewThread = async (threadId) => {
                try {
                    const res = await apiFetch(\`/api/books/forum/thread/\${threadId}\`);
                    setActiveThread(res);
                } catch (err) {
                    console.error('Failed to fetch thread details', err);
                }
            };

            // Post forum reply
            const handlePostReply = async (e) => {
                e.preventDefault();
                if (!replyContent || !activeThread) return;
                try {
                    await apiFetch(\`/api/books/forum/thread/\${activeThread.thread.id}/reply\`, {
                        method: 'POST',
                        body: JSON.stringify({ content: replyContent })
                    });
                    setReplyContent('');
                    viewThread(activeThread.thread.id);
                } catch (err) {
                    console.error('Failed to post reply', err);
                }
            };

            // Custom native WebRTC room component
            function VideoChatRoom({ club, onClose }) {
                const localVideoRef = useRef(null);
                const [cameraActive, setCameraActive] = useState(false);
                const [stream, setStream] = useState(null);

                useEffect(() => {
                    // Activate webcam stream natively
                    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                        .then(mediaStream => {
                            setStream(mediaStream);
                            if (localVideoRef.current) {
                                localVideoRef.current.srcObject = mediaStream;
                            }
                            setCameraActive(true);
                        })
                        .catch(err => {
                            console.error('Camera access denied:', err);
                        });

                    return () => {
                        if (stream) {
                            stream.getTracks().forEach(track => track.stop());
                        }
                    };
                }, []);

                return (
                    <div class="fixed inset-0 bg-black/90 z-50 flex flex-col p-6 overflow-y-auto">
                        <div class="flex justify-between items-center mb-6">
                            <div>
                                <span class="bg-brand-500 text-black font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider">Live Virtual Club</span>
                                <h2 class="text-2xl font-bold font-outfit mt-1">{club.name} Discussion</h2>
                            </div>
                            <button onClick={() => {
                                if (stream) stream.getTracks().forEach(track => track.stop());
                                onClose();
                            }} class="bg-slate-800 hover:bg-slate-700 text-white font-bold p-3 rounded-full transition duration-300">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        
                        {/* Live Video Feeds Grid */}
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow">
                            
                            {/* Local User Feed */}
                            <div class="glass-card rounded-2xl overflow-hidden relative aspect-video flex items-center justify-center bg-slate-900 border-2 border-brand-500/50">
                                <video ref={localVideoRef} autoPlay playsInline muted class="w-full h-full object-cover"></video>
                                <div class="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-lg text-xs font-semibold">
                                    You (Local Feed)
                                </div>
                            </div>
                            
                            {/* Simulated Peer Feed 1 */}
                            <div class="glass-card rounded-2xl overflow-hidden relative aspect-video flex flex-col items-center justify-center bg-slate-850">
                                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop" class="w-full h-full object-cover opacity-80" />
                                <div class="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-lg text-xs font-semibold">
                                    Sarah Jenkins
                                </div>
                            </div>

                            {/* Simulated Peer Feed 2 */}
                            <div class="glass-card rounded-2xl overflow-hidden relative aspect-video flex flex-col items-center justify-center bg-slate-850">
                                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop" class="w-full h-full object-cover opacity-80" />
                                <div class="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-lg text-xs font-semibold">
                                    Marcus Brody
                                </div>
                            </div>
                        </div>

                        {/* Interactive chat logs side room */}
                        <div class="mt-8 glass-card p-6 rounded-2xl">
                            <h3 class="font-bold text-lg mb-4 font-outfit"><i class="fas fa-comments text-brand-500 mr-2"></i>Live Club Notes & Quotes</h3>
                            <div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 h-32 overflow-y-auto mb-4 text-sm text-slate-300">
                                <p class="mb-2"><span class="text-brand-400 font-semibold">Sarah Jenkins:</span> "I really like the pacing of the second chapter, J.R.R. Tolkien excels in build-up!"</p>
                                <p class="mb-2"><span class="text-brand-400 font-semibold">Marcus Brody:</span> "Agreed, the descriptive elements really help envision the Shire."</p>
                            </div>
                            <div class="flex gap-2">
                                <input type="text" placeholder="Add a comment to the live room..." class="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex-grow focus:outline-none focus:border-brand-500 text-sm" />
                                <button class="bg-brand-500 hover:bg-brand-400 text-black px-6 py-3 rounded-xl font-bold transition duration-300">Send</button>
                            </div>
                        </div>
                    </div>
                );
            }

            function BookDetailsView({ book, onClose, onAddToLibrary, library, updateProgress }) {
                const inLib = library.find(item => item.id === book.id);
                // Custom chapters list
                const chaptersCount = 10;
                const dummyChapters = Array.from({ length: chaptersCount }, (_, i) => ({
                    num: chaptersCount - i,
                    title: "Chapter " + (chaptersCount - i) + ": " + book.title + " Chronicle",
                    date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toLocaleDateString(),
                    views: 24500 - i * 1500
                }));

                const readChapter = (chapterNum) => {
                    const percent = Math.round((chapterNum / chaptersCount) * 100);
                    updateProgress(book.id, percent, 'reading');
                    alert("Now reading Chapter " + chapterNum + "! Your library progress is updated to " + percent + "%.");
                };

                return (
                    <div class="space-y-6 animate-fadeIn bg-slate-900 border border-slate-800 rounded-3xl p-6">
                        <button onClick={onClose} class="text-slate-400 hover:text-white font-bold flex items-center gap-2 transition duration-300">
                            <i class="fas fa-arrow-left text-xs"></i> Back to Catalogue
                        </button>

                        <div class="flex flex-col md:flex-row gap-6">
                            {/* Left Cover Image */}
                            <div class="w-full md:w-44 flex-shrink-0">
                                <div class="aspect-[112/175] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-md">
                                    <img src={book.cover_url} class="w-full h-full object-cover" />
                                </div>
                                {!inLib && (
                                    <button onClick={() => onAddToLibrary(book.id)} class="w-full mt-4 bg-brand-500 hover:bg-brand-600 text-white font-bold py-2 rounded-xl text-xs transition">
                                        + Add to Library
                                    </button>
                                )}
                            </div>

                            {/* Right Info Details Sheet */}
                            <div class="flex-grow space-y-4">
                                <span class="bg-brand-500/10 text-brand-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border border-brand-500/20 tracking-wider font-roboto">Book Details</span>
                                <h2 class="text-2xl font-black text-white font-outfit mt-1">{book.title}</h2>
                                
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3.5 text-sm pt-2 border-t border-slate-800/80">
                                    <div class="flex gap-4">
                                        <span class="text-slate-400 font-semibold w-24">Alternative:</span>
                                        <span class="text-slate-200">{book.title} (Official)</span>
                                    </div>
                                    <div class="flex gap-4">
                                        <span class="text-slate-400 font-semibold w-24">Author:</span>
                                        <span class="text-brand-400 font-semibold">{book.author}</span>
                                    </div>
                                    <div class="flex gap-4">
                                        <span class="text-slate-400 font-semibold w-24">Status:</span>
                                        <span class="text-slate-200">Ongoing</span>
                                    </div>
                                    <div class="flex gap-4">
                                        <span class="text-slate-400 font-semibold w-24">Total Views:</span>
                                        <span class="text-slate-200">1.2M views</span>
                                    </div>
                                    <div class="flex gap-4 md:col-span-2">
                                        <span class="text-slate-400 font-semibold w-24">Genres:</span>
                                        <div class="flex flex-wrap gap-2">
                                            {book.genre.split(',').map((g, idx) => (
                                                <span key={idx} class="text-xs bg-[#2b2b2b] text-white px-2.5 py-1 rounded-md font-medium">{g.trim()}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Bookmark reading status tracker */}
                                {inLib && (
                                    <div class="bg-slate-955 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 mt-4">
                                        <div class="w-full md:w-2/3 space-y-1.5">
                                            <div class="flex justify-between items-center text-xs">
                                                <span class="text-slate-400 font-semibold">Your Library Progress:</span>
                                                <span class="text-brand-400 font-bold">{inLib.progress_percent}% ({Math.round(inLib.progress_percent / 10)} / 10 Chapters)</span>
                                            </div>
                                            <div class="w-full bg-slate-800 rounded-full h-1.5">
                                                <div class="bg-brand-500 h-1.5 rounded-full transition-all duration-300" style={{ width: inLib.progress_percent + "%" }}></div>
                                            </div>
                                        </div>
                                        <div class="flex gap-2 w-full md:w-auto">
                                            <button onClick={() => updateProgress(book.id, 100, 'finished')} class="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition">Mark Read</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Natomanga Notice Banner */}
                        <div class="bg-slate-955 border border-brand-500/30 p-4 rounded-2xl flex items-start gap-3.5">
                            <span class="text-brand-500 text-lg mt-0.5"><i class="fas fa-exclamation-circle"></i></span>
                            <div class="space-y-1">
                                <h4 class="text-xs font-bold text-slate-100 uppercase tracking-wide">📢 Notice for Readers</h4>
                                <p class="text-xs text-slate-400 leading-relaxed">
                                    Please read chapters sequentially. You can click on any chapter listed below to simulate the book reading experience, which will automatically synchronize with your dashboard and personal library!
                                </p>
                            </div>
                        </div>

                        {/* Chapters Listing Directory */}
                        <div class="space-y-4">
                            <h3 class="font-bold text-base font-outfit uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2"><i class="fas fa-list text-brand-400 mr-2"></i>Chapters Directory</h3>
                            
                            <div class="overflow-x-auto">
                                <table class="w-full text-left border-collapse text-xs md:text-sm">
                                    <thead>
                                        <tr class="border-b border-slate-800 text-brand-400 font-bold">
                                            <th class="py-2.5 px-4">CHAPTER NAME</th>
                                            <th class="py-2.5 px-4">DISPATCH DATE</th>
                                            <th class="py-2.5 px-4 text-right">TOTAL VIEWS</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-slate-800/50">
                                        {dummyChapters.map((ch, idx) => (
                                            <tr key={idx} class="hover:bg-slate-955/60 transition group">
                                                <td class="py-3 px-4">
                                                    <button onClick={() => readChapter(ch.num)} class="text-left font-semibold text-slate-100 hover:text-brand-400 group-hover:underline transition">
                                                        {ch.title}
                                                    </button>
                                                </td>
                                                <td class="py-3 px-4 text-slate-400">{ch.date}</td>
                                                <td class="py-3 px-4 text-right text-slate-400 font-medium">{ch.views.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            }

            return (
                <div class="min-h-screen flex flex-col bg-slate-950 text-slate-100">                    {/* Header */}
                    <header class="bg-slate-900 border-b border-slate-800/80 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div class="flex items-center justify-between w-full md:w-auto gap-4">
                            {/* Logo panel with white background in light mode, dark in dark mode */}
                            <div class="bg-slate-950 px-5 py-2.5 rounded-lg flex items-center gap-3 border border-slate-800">
                                <div class="bg-brand-500 text-white w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shadow-brand-500/20">
                                    <i class="fas fa-book-open text-sm"></i>
                                </div>
                                <span class="text-xl font-bold tracking-tight font-roboto text-slate-100">BookHaven</span>
                            </div>

                            {/* Theme and notifications for Mobile view */}
                            <div class="flex md:hidden items-center gap-2">
                                <button onClick={toggleTheme} class="p-2 text-slate-400 hover:text-brand-500 rounded-xl transition duration-300" title="Toggle Theme">
                                    <i class={isDarkMode ? "fas fa-sun text-amber-400" : "fas fa-moon text-slate-500"}></i>
                                </button>
                                {auth && (
                                    <button onClick={handleLogout} class="text-slate-400 hover:text-red-400 p-2 transition duration-300">
                                        <i class="fas fa-sign-out-alt"></i>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Search Bar matching Natomanga style */}
                        {auth && (
                            <div class="w-full md:max-w-md relative">
                                <input 
                                    type="text" 
                                    placeholder="Search stories, authors, tags..." 
                                    value={activeTab === 'manga' ? mangaSearch : searchQuery}
                                    onChange={(e) => {
                                        if (activeTab === 'manga') {
                                            setMangaSearch(e.target.value);
                                        } else {
                                            setSearchQuery(e.target.value);
                                        }
                                    }}
                                    class="w-full bg-slate-955 text-slate-100 pl-10 pr-4 py-2 border-b-2 border-brand-500 focus:outline-none text-sm transition"
                                />
                                <i class="fas fa-search absolute left-3 top-3 text-slate-400 text-xs"></i>
                            </div>
                        )}

                        {/* Right side controls */}
                        <div class="hidden md:flex items-center gap-4">
                            <button onClick={toggleTheme} class="p-2 text-slate-400 hover:text-brand-500 rounded-xl transition duration-300 flex items-center justify-center" title="Toggle Theme">
                                <i class={isDarkMode ? "fas fa-sun text-lg text-amber-400" : "fas fa-moon text-lg text-slate-500"}></i>
                            </button>

                            {auth ? (
                                <div class="flex items-center gap-4">
                                    {/* Notifications */}
                                    <div class="relative">
                                        <button onClick={() => setShowNotifications(!showNotifications)} class="relative p-2 text-slate-400 hover:text-slate-100 transition duration-300">
                                            <i class="fas fa-bell text-lg"></i>
                                            <span class="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                                        </button>
                                        
                                        {showNotifications && (
                                            <div class="absolute right-0 mt-3 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-4 z-50 text-sm">
                                                <h4 class="font-bold border-b border-slate-800 pb-2 mb-3 text-slate-100">Notification Inbox</h4>
                                                <div class="space-y-3">
                                                    <div class="flex gap-3">
                                                        <div class="w-2 h-2 mt-1.5 bg-brand-500 rounded-full flex-shrink-0"></div>
                                                        <p class="text-slate-300"><span class="text-white font-semibold">Sarah Jenkins</span> joined the Fantasy Expedition book club room.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Profile Panel styled as a tight Natomanga-style widget */}
                                    <div class="flex items-center gap-2.5 bg-slate-950 py-1.5 px-3 rounded-lg border border-slate-800">
                                        <div class="w-8 h-8 rounded-full bg-slate-850 border border-slate-700 relative overflow-hidden">
                                            <img src={auth.user?.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=book'} class="w-full h-full rounded-full" />
                                        </div>
                                        <div class="text-left">
                                            <div class="text-xs font-semibold text-slate-200">{auth.user?.username}</div>
                                            <div class="text-[10px] text-slate-400 capitalize">{auth.user?.provider} reader</div>
                                        </div>
                                        <button onClick={handleLogout} class="text-slate-400 hover:text-red-400 text-xs p-1.5 transition duration-300" title="Logout">
                                            <i class="fas fa-sign-out-alt"></i>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => setShowAuthModal(true)} class="bg-brand-500 hover:bg-brand-600 text-white font-bold px-5 py-2 rounded-lg transition duration-350 shadow-md shadow-brand-500/10 text-sm">
                                    Get Started
                                </button>
                            )}
                        </div>
                    </header>

                    {/* Navigation Tabs Bar / Orange menu-primary bar in Light mode, Dark Teal in Dark mode */}
                    {auth && (
                        <div class="bg-brand-500 dark:bg-[#2a524a] px-6 py-1 border-b border-brand-600 dark:border-teal-800 flex flex-col md:flex-row justify-between items-center gap-2">
                            <div class="flex flex-wrap gap-1 text-sm w-full md:w-auto justify-center md:justify-start">
                                {[
                                    { id: 'home', label: 'HOME', icon: 'fa-chart-pie' },
                                    { id: 'library', label: 'MY LIBRARY', icon: 'fa-books' },
                                    { id: 'discover', label: 'DISCOVER DIRECTORY', icon: 'fa-search' },
                                    { id: 'manga', label: 'MANGA HUB', icon: 'fa-book-open-reader' },
                                    { id: 'social', label: 'COMMUNITY FEED', icon: 'fa-rss' },
                                    { id: 'clubs', label: 'BOOK CLUBS', icon: 'fa-users' },
                                    { id: 'forum', label: 'DISCUSSION FORUM', icon: 'fa-comments' }
                                ].map(tab => (
                                    <button 
                                        key={tab.id} 
                                        onClick={() => { setActiveTab(tab.id); setActiveThread(null); }} 
                                        class={'flex items-center gap-2 px-4 py-2.5 font-bold uppercase transition duration-300 text-xs ' + (activeTab === tab.id ? 'bg-[#2b2b2b] text-[#fc0] dark:text-[#fc0]' : 'text-white hover:text-yellow-250')}
                                    >
                                        <i class={'fas ' + tab.icon + ' text-[10px]'}></i>
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* YA vs Adult Switcher nested inside Navigation bar */}
                            <div class="flex bg-black/35 rounded-lg p-0.5 border border-white/10 my-1 md:my-0">
                                <button onClick={() => setAgeGroup('ya')} class={'px-3 py-1 rounded-md text-[10px] font-bold uppercase transition duration-350 ' + (ageGroup === 'ya' ? 'bg-brand-500 text-white' : 'text-white/60 hover:text-white')}>
                                    YA
                                </button>
                                <button onClick={() => setAgeGroup('adult')} class={'px-3 py-1 rounded-md text-[10px] font-bold uppercase transition duration-350 ' + (ageGroup === 'adult' ? 'bg-brand-500 text-white' : 'text-white/60 hover:text-white')}>
                                    Adult (18+)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* App Core Views */}
                    {auth ? (
                        <main class="flex-grow p-6 md:p-8 max-w-7xl mx-auto w-full">
                                                        {/* HOME/DASHBOARD VIEW */}
                            {activeTab === 'home' && (
                                <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start animate-fadeIn">
                                    
                                    {/* Left Column - Popular carousel & recommendations feed */}
                                    <div class="lg:col-span-3 space-y-6">
                                        
                                        {/* Natomanga Style Popular Slider */}
                                        <div class="relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden aspect-[21/9] md:aspect-[3/1] group shadow-lg">
                                            <div class="absolute top-0 left-0 bg-brand-500 text-white font-bold text-xs uppercase px-4 py-2 z-10 rounded-br-xl shadow-md font-roboto">
                                                ★ POPULAR BOOK SUGGESTIONS
                                            </div>
                                            
                                            {isLoading || suggestions.length === 0 ? (
                                                <div class="w-full h-full bg-slate-950 animate-pulse flex items-center justify-center text-slate-505">
                                                    <i class="fas fa-spinner fa-spin mr-2"></i> Loading suggestions...
                                                </div>
                                            ) : (
                                                <>
                                                    {/* Slider track */}
                                                    <div class="w-full h-full relative overflow-hidden">
                                                        {suggestions.slice(0, 5).map((book, idx) => (
                                                            <div 
                                                                key={book.id} 
                                                                class={'absolute inset-0 transition-opacity duration-1000 flex ' + (idx === currentSlide ? 'opacity-100 z-0' : 'opacity-0 -z-10 pointer-events-none')}
                                                            >
                                                                {/* Blurred background image cover */}
                                                                <div class="absolute inset-0 scale-105 filter blur-xl opacity-40 bg-cover bg-center" style={{ backgroundImage: "url(" + book.cover_url + ")" }}></div>
                                                                
                                                                <div class="relative flex w-full h-full p-6 md:p-8 items-center gap-6 z-10">
                                                                    <img src={book.cover_url} class="h-4/5 object-cover rounded-lg border border-white/20 shadow-lg" />
                                                                    <div class="flex-grow flex flex-col justify-center">
                                                                        <span class="text-[9px] bg-brand-500 text-white font-bold px-2 py-0.5 rounded w-max mb-1.5 uppercase font-roboto">{book.genre}</span>
                                                                        <h3 class="text-xl md:text-2xl font-black text-white font-outfit line-clamp-1">{book.title}</h3>
                                                                        <p class="text-xs md:text-sm text-slate-300 mt-1">Author: {book.author}</p>
                                                                        <p class="text-xs text-slate-400 mt-2 line-clamp-2 max-w-md hidden md:block">Based on your reading analytics and profile preferences, BookHaven recommends this trending book.</p>
                                                                        <button onClick={() => addToLibrary(book.id)} class="mt-4 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs px-4 py-2 rounded-lg w-max transition">
                                                                            + Add to My Library
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    
                                                    {/* Slider navigation dots */}
                                                    <div class="absolute bottom-4 right-4 flex gap-1.5 z-20">
                                                        {suggestions.slice(0, 5).map((_, idx) => (
                                                            <button 
                                                                key={idx} 
                                                                onClick={() => setCurrentSlide(idx)} 
                                                                class={'w-2.5 h-2.5 rounded-full transition ' + (idx === currentSlide ? 'bg-brand-500 scale-120' : 'bg-slate-700 hover:bg-slate-500')}
                                                            />
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Recommended Directory Grid matching Natomanga style */}
                                        <div class="space-y-4">
                                            <h3 class="text-lg font-bold font-outfit uppercase tracking-wider text-slate-100 border-b border-slate-800 pb-2"><i class="fas fa-compass text-brand-500 mr-2"></i>RECOMMENDED FOR YOU</h3>
                                            
                                            <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                                                {isLoading ? (
                                                     [1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                                         <div key={i} class="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between animate-pulse">
                                                             <div class="aspect-[112/175] rounded-lg bg-slate-800/50 mb-3 border border-slate-700/50"></div>
                                                             <div class="space-y-2">
                                                                 <div class="h-4 bg-slate-800 rounded w-3/4"></div>
                                                                 <div class="h-3 bg-slate-800 rounded w-1/2"></div>
                                                                 <div class="h-7 bg-slate-800 rounded w-full mt-3"></div>
                                                             </div>
                                                         </div>
                                                     ))
                                                ) : (
                                                     suggestions.map(book => {
                                                         // Determine custom badging status dynamically based on book rating/genre
                                                         const isHot = book.id % 2 === 0;
                                                         const isNew = book.id % 3 === 0;
                                                         return (
                                                             <div key={book.id} class="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-brand-500 transition duration-300 relative group overflow-hidden">
                                                                 {/* Natomanga status badge overlay */}
                                                                 <div class="absolute top-2 left-2 z-10 flex flex-col gap-1">
                                                                     {isHot && <span class="bg-[#c0392b] text-white font-black text-[9px] px-1.5 py-0.5 rounded font-roboto uppercase shadow-sm">HOT</span>}
                                                                     {isNew && <span class="bg-[#2ecc71] text-white font-black text-[9px] px-1.5 py-0.5 rounded font-roboto uppercase shadow-sm">NEW</span>}
                                                                     {!isHot && !isNew && <span class="bg-black text-white font-black text-[9px] px-1.5 py-0.5 rounded font-roboto uppercase shadow-sm">SS</span>}
                                                                 </div>

                                                                 <div class="aspect-[112/175] rounded-lg overflow-hidden bg-slate-955 mb-3 border border-slate-800 relative shadow-inner group-hover:scale-103 transition duration-350">
                                                                     <img src={book.cover_url} class="w-full h-full object-cover" />
                                                                     <span class="absolute bottom-2 right-2 bg-black/80 text-[8px] font-bold px-1.5 py-0.5 rounded text-brand-300 font-roboto">{book.genre.toUpperCase()}</span>
                                                                 </div>
                                                                 <div>
                                                                     <h4 class="font-bold text-sm text-slate-100 line-clamp-1 font-outfit" title={book.title}>{book.title}</h4>
                                                                     <p class="text-[11px] text-slate-400 mb-3">{book.author}</p>
                                                                     <button onClick={() => addToLibrary(book.id)} class="w-full bg-slate-955 hover:bg-brand-500 hover:text-white border border-slate-805 text-slate-300 py-1.5 rounded-lg text-xs font-semibold transition">
                                                                         + Add Library
                                                                     </button>
                                                                 </div>
                                                             </div>
                                                         );
                                                     })
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column - User profile card, history progress, and challenges */}
                                    <div class="lg:col-span-1 space-y-6">
                                        
                                        {/* Profile Card */}
                                        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
                                            <div>
                                                <h3 class="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2 border-b border-slate-800 pb-1.5"><i class="fas fa-id-card text-brand-500 mr-1.5"></i>Active Reader</h3>
                                                <div class="flex items-center gap-3.5 mt-3">
                                                    <div class="w-12 h-12 bg-slate-950 rounded-xl border border-slate-800 p-1 flex-shrink-0">
                                                        <img src={auth.user?.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=book'} class="w-full h-full rounded-lg" />
                                                    </div>
                                                    <div>
                                                        <h2 class="text-base font-bold font-outfit text-white leading-tight">{auth.user?.username}</h2>
                                                        <p class="text-[10px] text-slate-400 mt-0.5">Library size: {library.length} books</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="mt-4 border-t border-slate-800 pt-3 flex justify-between items-center text-xs">
                                                <span class="text-slate-400">Content level:</span>
                                                <span class="bg-brand-500/10 text-brand-400 text-[10px] font-bold px-2 py-0.5 rounded border border-brand-500/20 uppercase tracking-wider">{ageGroup}</span>
                                            </div>
                                        </div>

                                        {/* Currently Reading History sidebar */}
                                        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                                            <h3 class="text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800 pb-1.5"><i class="fas fa-history text-brand-500 mr-1.5"></i>READING HISTORY</h3>
                                            
                                            {isLoading ? (
                                                <div class="space-y-3 animate-pulse">
                                                    {[1, 2].map(i => (
                                                        <div key={i} class="h-10 bg-slate-950 rounded border border-slate-800"></div>
                                                    ))}
                                                </div>
                                            ) : library.filter(b => b.status === 'reading').length > 0 ? (
                                                <div class="space-y-3">
                                                    {library.filter(b => b.status === 'reading').slice(0, 3).map(book => (
                                                        <div key={book.id} class="bg-slate-955 p-3 rounded-lg border border-slate-800">
                                                            <div class="flex justify-between items-center mb-1.5">
                                                                <h4 class="font-semibold text-xs text-slate-100 line-clamp-1">{book.title}</h4>
                                                                <span class="text-[10px] text-[#3498db] font-bold">{book.progress_percent}%</span>
                                                            </div>
                                                            <div class="w-full bg-slate-800 rounded-full h-1">
                                                                <div class="bg-[#3498db] h-1 rounded-full" style={{ width: book.progress_percent + "%" }}></div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div class="text-center py-4 text-slate-500 text-xs">
                                                    <i class="fas fa-book-reader text-lg mb-1.5 block text-slate-650"></i>
                                                    <span>No active reads</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Reading Challenges widget */}
                                        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                                            <h3 class="text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800 pb-1.5"><i class="fas fa-trophy text-brand-500 mr-1.5"></i>CHALLENGES</h3>
                                            <div class="space-y-3">
                                                {challenges.slice(0, 2).map(ch => (
                                                    <div key={ch.id} class="bg-slate-955 p-3 rounded-lg border border-slate-805">
                                                        <div class="flex justify-between items-center mb-1">
                                                            <h4 class="font-semibold text-xs text-slate-100">{ch.title}</h4>
                                                            {ch.joined ? (
                                                                <span class="text-[10px] text-slate-400 font-bold">{ch.books_read || 0}/{ch.target_count}</span>
                                                            ) : (
                                                                <button onClick={() => joinChallenge(ch.id)} class="text-[9px] bg-brand-500 text-white px-2 py-0.5 rounded font-bold hover:bg-brand-600">Join</button>
                                                            )}
                                                        </div>
                                                        {ch.joined && (
                                                            <div class="w-full bg-slate-800 rounded-full h-1 mt-1.5">
                                                                <div class="bg-emerald-500 h-1 rounded-full" style={{ width: Math.min(100, ((ch.books_read || 0) / ch.target_count) * 100) + "%" }}></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Natomanga Style Important Bookmark Notice */}
                                        <div class="bg-slate-900 border-l-4 border-brand-500 p-4 rounded-r-xl space-y-1">
                                            <h4 class="text-xs font-bold text-slate-100 uppercase tracking-wide">📢 Important Notice!</h4>
                                            <p class="text-[10px] text-slate-400 leading-relaxed">
                                                Bookmark this site: press <strong class="text-brand-400">Ctrl + D</strong> (Windows) or <strong class="text-brand-400">Cmd + D</strong> (Mac) to preserve local state. Add to home screen for mobile reading.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* LIBRARY VIEW */}
                            {activeTab === 'library' && (
                                <div class="space-y-6 animate-fadeIn">
                                    <div class="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                                        <div class="relative w-full sm:w-72">
                                            <input type="text" placeholder="Search my library..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} class="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 pl-10 w-full focus:outline-none focus:border-brand-500 text-sm" />
                                            <i class="fas fa-search absolute left-3.5 top-3.5 text-slate-400 text-xs"></i>
                                        </div>
                                        <div class="flex gap-2 w-full sm:w-auto">
                                            {['all', 'reading', 'want_to_read', 'finished'].map(status => (
                                                 <button key={status} onClick={() => setFilterStatus(status)} class={\`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition duration-300 \${filterStatus === status ? 'bg-brand-500 text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-750'}\`}>
                                                    {status.replace(/_/g, ' ')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {isLoading ? (
                                        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            {[1, 2, 3, 4].map(i => (
                                                <div key={i} class="glass-card rounded-2xl p-5 flex flex-col justify-between border border-slate-800 animate-pulse">
                                                    <div>
                                                        <div class="aspect-[3/4] rounded-xl bg-slate-800/50 mb-4 border border-slate-700/50"></div>
                                                        <div class="h-5 bg-slate-800 rounded w-3/4 mb-2"></div>
                                                        <div class="h-3.5 bg-slate-850 rounded w-1/2 mb-4"></div>
                                                        <div class="h-12 bg-slate-800/55 rounded-xl mt-4"></div>
                                                    </div>
                                                    <div class="h-8 bg-slate-800/40 rounded-xl mt-4 pt-4"></div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : library.length > 0 ? (
                                        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            {library
                                                .filter(b => {
                                                    const matchesSearch = b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.author.toLowerCase().includes(searchQuery.toLowerCase());
                                                    const matchesStatus = filterStatus === 'all' || b.status === filterStatus;
                                                    return matchesSearch && matchesStatus;
                                                })
                                                .map(book => (
                                                    <div key={book.id} class="glass-card rounded-2xl p-5 flex flex-col justify-between relative border border-slate-800 hover:border-slate-700 transition duration-300">
                                                        <div>
                                                            <div class="aspect-[3/4] rounded-xl overflow-hidden bg-slate-800 mb-4 border border-slate-700 relative">
                                                                <img src={book.cover_url} class="w-full h-full object-cover" />
                                                                <span class="absolute top-3 right-3 bg-brand-500 text-black font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">{book.status}</span>
                                                            </div>
                                                            <h4 class="font-bold text-lg text-white leading-tight font-outfit">{book.title}</h4>
                                                            <p class="text-xs text-slate-400 mt-1 mb-4">{book.author}</p>
                                                            
                                                            {/* Reading progress slide widget */}
                                                            <div class="space-y-2 mt-4 bg-slate-900/40 p-3 rounded-xl border border-slate-850">
                                                                <div class="flex justify-between items-center text-xs">
                                                                    <span class="text-slate-400">Reading Progress:</span>
                                                                    <span class="text-brand-400 font-bold">{book.progress_percent}%</span>
                                                                </div>
                                                                <input type="range" min="0" max="100" value={book.progress_percent} onChange={(e) => updateProgress(book.id, parseInt(e.target.value))} class="w-full accent-brand-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                                                            </div>
                                                        </div>

                                                        {/* Favorite Quote & Review Form */}
                                                        <div class="mt-4 border-t border-slate-800/80 pt-4 space-y-3">
                                                            {book.favorite_quote ? (
                                                                <div class="bg-slate-900/45 p-3 rounded-xl border-l-2 border-brand-500 italic text-xs text-slate-300">
                                                                    "{book.favorite_quote}"
                                                                </div>
                                                            ) : (
                                                                <button onClick={() => {
                                                                    const quote = prompt('Enter your favorite quote:');
                                                                    if (quote) saveReviewQuote(book.id, null, quote, null);
                                                                }} class="w-full bg-slate-900 hover:bg-slate-850 text-slate-400 py-2 rounded-xl text-xs font-semibold border border-slate-800 hover:text-white transition duration-300">
                                                                    + Add favorite quote
                                                                </button>
                                                            )}
                                                            
                                                            {book.review_text ? (
                                                                <div class="bg-slate-900/45 p-3 rounded-xl text-xs text-slate-300">
                                                                    <span class="font-bold block text-white mb-1">My Review ({book.rating}⭐):</span>
                                                                    {book.review_text}
                                                                </div>
                                                            ) : (
                                                                <button onClick={() => {
                                                                    const rating = parseInt(prompt('Rate this book (1-5):') || '5');
                                                                    const review = prompt('Write your review:');
                                                                    if (review) saveReviewQuote(book.id, review, null, rating);
                                                                }} class="w-full bg-slate-900 hover:bg-slate-850 text-slate-400 py-2 rounded-xl text-xs font-semibold border border-slate-800 hover:text-white transition duration-300">
                                                                    + Add a review
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    ) : (
                                        <div class="h-64 flex flex-col items-center justify-center text-slate-500">
                                            <i class="fas fa-books-medical text-3xl mb-3 text-slate-650"></i>
                                            <span>Your library is empty. Head to Discover Catalogue to find books!</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* DISCOVER VIEW */}
                            {activeTab === 'discover' && (
                                <div class="space-y-8 animate-fadeIn">
                                    {selectedBook ? (
                                        <BookDetailsView 
                                            book={selectedBook} 
                                            onClose={() => setSelectedBook(null)} 
                                            onAddToLibrary={addToLibrary} 
                                            library={library} 
                                            updateProgress={updateProgress}
                                        />
                                    ) : (
                                        <>
                                            <div class="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                                                <div class="relative w-full sm:w-72">
                                                    <input type="text" placeholder="Search entire catalog..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} class="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 pl-10 w-full focus:outline-none focus:border-brand-500 text-sm" />
                                                    <i class="fas fa-search absolute left-3.5 top-3.5 text-slate-400 text-xs"></i>
                                                </div>
                                                <button onClick={() => setShowCreateListingModal(true)} class="bg-brand-500 hover:bg-brand-400 text-black px-6 py-2.5 rounded-xl font-bold text-sm transition duration-300 shadow-lg shadow-brand-500/10">
                                                    List Book for Sale/Trade
                                                </button>
                                            </div>

                                            {/* Main Catalogue */}
                                            <div class="space-y-4">
                                                <h3 class="text-lg font-bold font-outfit uppercase tracking-wider text-slate-100 border-b border-slate-800 pb-2"><i class="fas fa-compass text-brand-500 mr-2"></i>General Directory ({ageGroup.toUpperCase()})</h3>
                                                
                                                <div class="grid grid-cols-2 md:grid-cols-6 gap-6">
                                                    {isLoading ? (
                                                        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
                                                            <div key={i} class="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between animate-pulse">
                                                                <div>
                                                                    <div class="aspect-[112/175] rounded-lg bg-slate-800/50 mb-3 border border-slate-700/50"></div>
                                                                    <div class="h-4 bg-slate-800 rounded w-3/4 mb-1"></div>
                                                                    <div class="h-3 bg-slate-850 rounded w-1/2 mb-3"></div>
                                                                </div>
                                                                <div class="h-8 bg-slate-805 rounded-xl"></div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        catalogue
                                                            .filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.author.toLowerCase().includes(searchQuery.toLowerCase()))
                                                            .map(book => {
                                                                const isHot = book.id % 2 === 0;
                                                                const isNew = book.id % 3 === 0;
                                                                return (
                                                                    <div key={book.id} class="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-brand-500 transition duration-300 relative group overflow-hidden">
                                                                        {/* Natomanga status badge overlay */}
                                                                        <div class="absolute top-2 left-2 z-10 flex flex-col gap-1">
                                                                            {isHot && <span class="bg-[#c0392b] text-white font-black text-[9px] px-1.5 py-0.5 rounded font-roboto uppercase shadow-sm">HOT</span>}
                                                                            {isNew && <span class="bg-[#2ecc71] text-white font-black text-[9px] px-1.5 py-0.5 rounded font-roboto uppercase shadow-sm">NEW</span>}
                                                                            {!isHot && !isNew && <span class="bg-black text-white font-black text-[9px] px-1.5 py-0.5 rounded font-roboto uppercase shadow-sm">SS</span>}
                                                                        </div>

                                                                        <div onClick={() => setSelectedBook(book)} class="aspect-[112/175] rounded-lg overflow-hidden bg-slate-955 mb-3 border border-slate-800 relative shadow-inner group-hover:scale-103 transition duration-350 cursor-pointer">
                                                                            <img src={book.cover_url} class="w-full h-full object-cover" />
                                                                            <span class="absolute bottom-2 right-2 bg-black/80 text-[8px] font-bold px-1.5 py-0.5 rounded text-brand-300 font-roboto">{book.genre.split(',')[0].toUpperCase()}</span>
                                                                        </div>
                                                                        <div>
                                                                            <h4 onClick={() => setSelectedBook(book)} class="font-bold text-sm text-slate-100 line-clamp-1 font-outfit cursor-pointer hover:text-brand-500" title={book.title}>{book.title}</h4>
                                                                            <p class="text-[11px] text-slate-400 mb-3">{book.author}</p>
                                                                            <button onClick={() => addToLibrary(book.id)} class="w-full bg-slate-955 hover:bg-brand-500 hover:text-white border border-slate-805 text-slate-300 py-1.5 rounded-lg text-xs font-semibold transition">
                                                                                + Add Library
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                                  {/* MANGA HUB VIEW */}
                            {activeTab === 'manga' && (
                                <div class="space-y-8 animate-fadeIn">
                                    {selectedBook ? (
                                        <BookDetailsView 
                                            book={selectedBook} 
                                            onClose={() => setSelectedBook(null)} 
                                            onAddToLibrary={addToLibrary} 
                                            library={library} 
                                            updateProgress={updateProgress}
                                        />
                                    ) : (
                                        <>
                                            <div class="bg-gradient-to-r from-brand-900/30 via-slate-900/80 to-slate-900/40 p-6 rounded-3xl border border-brand-500/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                                <div>
                                                    <span class="bg-brand-500 text-black font-bold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">Manga & Manhua Hub</span>
                                                    <h2 class="text-3xl font-extrabold font-outfit text-white mt-2">Natomanga Catalog</h2>
                                                    <p class="text-sm text-slate-400 mt-1">Browse, filter, and track reading progress for the top Japanese Manga & Korean Manhwa.</p>
                                                </div>
                                                <div class="relative w-full md:w-72">
                                                    <input type="text" placeholder="Search title or author..." value={mangaSearch} onChange={(e) => setMangaSearch(e.target.value)} class="bg-slate-855 border border-slate-700 rounded-xl px-4 py-2.5 pl-10 w-full focus:outline-none focus:border-brand-500 text-white text-sm" />
                                                    <i class="fas fa-search absolute left-3.5 top-3.5 text-slate-400 text-xs"></i>
                                                </div>
                                            </div>

                                            {/* Categorization & Navigation Rows */}
                                            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                                                
                                                {/* Left Side Filters (Tags, Genres, Authors) */}
                                                <div class="space-y-6">
                                                    
                                                    {/* Filter by Genre */}
                                                    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                                                        <h3 class="font-bold text-sm font-outfit uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2"><i class="fas fa-filter text-brand-400 mr-2"></i>Genres</h3>
                                                        <div class="flex flex-wrap gap-2">
                                                            {['all', 'Action', 'Fantasy', 'Romance', 'Drama', 'Adventure', 'Comedy', 'Mystery', 'Historical', 'Supernatural'].map(g => (
                                                                <button key={g} onClick={() => setMangaGenre(g)} class={mangaGenre === g ? 'px-3 py-1.5 rounded-lg text-[10px] font-semibold transition bg-brand-500 text-black font-bold' : 'px-3 py-1.5 rounded-lg text-[10px] font-semibold transition bg-slate-800 hover:bg-slate-750 text-slate-355'}>
                                                                    {g}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Filter by Tag */}
                                                    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                                                        <h3 class="font-bold text-sm font-outfit uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2"><i class="fas fa-tags text-brand-400 mr-2"></i>Tags</h3>
                                                        <div class="flex flex-wrap gap-2">
                                                            {['all', 'Reincarnation', 'Isekai', 'Webtoon', 'Slice of Life', 'Crime', 'Thriller'].map(t => (
                                                                <button key={t} onClick={() => setMangaTag(t)} class={mangaTag === t ? 'px-3 py-1.5 rounded-lg text-[10px] font-semibold transition bg-brand-500 text-black font-bold' : 'px-3 py-1.5 rounded-lg text-[10px] font-semibold transition bg-slate-800 hover:bg-slate-750 text-slate-355'}>
                                                                    {t}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Filter by Author */}
                                                    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                                                        <h3 class="font-bold text-sm font-outfit uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2"><i class="fas fa-user-edit text-brand-400 mr-2"></i>Authors</h3>
                                                        <div class="max-h-48 overflow-y-auto space-y-1 pr-2">
                                                            <button onClick={() => setMangaAuthor('all')} class={mangaAuthor === 'all' ? 'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition bg-brand-500/20 text-brand-300 border border-brand-500/30' : 'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition text-slate-400 hover:text-white hover:bg-slate-800'}>
                                                                All Authors
                                                            </button>
                                                            {Array.from(new Set(catalogue.filter(b => b.genre.includes('Manga')).map(b => b.author))).map(authorName => (
                                                                <button key={authorName} onClick={() => setMangaAuthor(authorName)} class={mangaAuthor === authorName ? 'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition truncate bg-brand-500/20 text-brand-300 border border-brand-500/30' : 'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition truncate text-slate-400 hover:text-white hover:bg-slate-800'}>
                                                                    {authorName}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right Side Manga Grid */}
                                                <div class="md:col-span-3 space-y-4">
                                                    <div class="flex justify-between items-center text-xs text-slate-400">
                                                        <span>Listing top manga details</span>
                                                        <button onClick={() => { setMangaGenre('all'); setMangaTag('all'); setMangaAuthor('all'); setMangaSearch(''); }} class="text-brand-400 hover:text-brand-300"><i class="fas fa-undo mr-1"></i>Reset Filters</button>
                                                    </div>

                                                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                                        {catalogue
                                                            .filter(b => b.genre.includes('Manga'))
                                                            .filter(b => {
                                                                const matchesSearch = b.title.toLowerCase().includes(mangaSearch.toLowerCase()) || b.author.toLowerCase().includes(mangaSearch.toLowerCase());
                                                                const matchesGenre = mangaGenre === 'all' || b.genre.includes(mangaGenre);
                                                                const matchesTag = mangaTag === 'all' || b.genre.includes(mangaTag);
                                                                const matchesAuthor = mangaAuthor === 'all' || b.author === mangaAuthor;
                                                                return matchesSearch && matchesGenre && matchesTag && matchesAuthor;
                                                            })
                                                            .map(manga => {
                                                                const inLib = library.find(item => item.id === manga.id);
                                                                const isHot = manga.id % 2 === 0;
                                                                const isNew = manga.id % 3 === 0;
                                                                return (
                                                                    <div key={manga.id} class="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-brand-500 transition duration-300 relative group overflow-hidden">
                                                                        {/* Natomanga status badge overlay */}
                                                                        <div class="absolute top-2 left-2 z-10 flex flex-col gap-1">
                                                                            {isHot && <span class="bg-[#c0392b] text-white font-black text-[9px] px-1.5 py-0.5 rounded font-roboto uppercase shadow-sm">HOT</span>}
                                                                            {isNew && <span class="bg-[#2ecc71] text-white font-black text-[9px] px-1.5 py-0.5 rounded font-roboto uppercase shadow-sm">NEW</span>}
                                                                            {!isHot && !isNew && <span class="bg-black text-white font-black text-[9px] px-1.5 py-0.5 rounded font-roboto uppercase shadow-sm">SS</span>}
                                                                        </div>

                                                                        <div onClick={() => setSelectedBook(manga)} class="aspect-[112/175] rounded-lg overflow-hidden bg-slate-955 mb-3 border border-slate-800 relative shadow-inner group-hover:scale-103 transition duration-350 cursor-pointer">
                                                                            <img src={manga.cover_url} class="w-full h-full object-cover" />
                                                                            <span class="absolute bottom-2 right-2 bg-black/80 text-[8px] font-bold px-1.5 py-0.5 rounded text-brand-300 font-roboto">{manga.category.toUpperCase()}</span>
                                                                        </div>
                                                                        <div>
                                                                            <h4 onClick={() => setSelectedBook(manga)} class="font-bold text-sm text-slate-100 line-clamp-1 font-outfit cursor-pointer hover:text-brand-500" title={manga.title}>{manga.title}</h4>
                                                                            <p class="text-[11px] text-slate-400 mt-0.5 mb-2">{manga.author}</p>
                                                                            
                                                                            <div class="flex flex-wrap gap-1 mb-3">
                                                                                {manga.genre.split(',').slice(0, 3).map((tagStr, tagIdx) => (
                                                                                    <span key={tagIdx} class="text-[9px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-medium">{tagStr.replace('Manga', '').trim()}</span>
                                                                                ))}
                                                                            </div>
                                                                        </div>

                                                                        {inLib ? (
                                                                            <div class="space-y-2 mt-2">
                                                                                <div class="flex justify-between items-center text-[10px]">
                                                                                    <span class="text-slate-400">Chapters read:</span>
                                                                                    <span class="text-brand-400 font-bold">{inLib.progress_percent}%</span>
                                                                                </div>
                                                                                <input type="range" min="0" max="100" value={inLib.progress_percent} onChange={(e) => updateProgress(manga.id, parseInt(e.target.value))} class="w-full accent-brand-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                                                                            </div>
                                                                        ) : (
                                                                            <button onClick={() => addToLibrary(manga.id)} class="w-full bg-slate-955 hover:bg-brand-500 hover:text-white border border-slate-855 text-slate-350 py-1.5 rounded-lg text-xs font-semibold transition">
                                                                                + Add Library
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                </div>
                            )}

                            {/* SOCIAL FEED VIEW */}
                            {activeTab === 'social' && (

                                <div class="max-w-2xl mx-auto space-y-6 animate-fadeIn">
                                    <div class="glass-card p-6 rounded-2xl border border-slate-800">
                                        <h3 class="font-bold text-lg mb-4 font-outfit">Community Updates</h3>
                                        {feed.length > 0 ? (
                                            <div class="space-y-6">
                                                {feed.map((post, idx) => (
                                                    <div key={idx} class="bg-slate-900/60 p-5 rounded-2xl border border-slate-850 flex gap-4">
                                                        <div class="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex-shrink-0">
                                                            <img src={post.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=book'} class="w-full h-full rounded-full" />
                                                        </div>
                                                        <div class="flex-grow space-y-2">
                                                            <div class="flex justify-between items-center">
                                                                <span class="font-bold text-sm text-white">{post.username}</span>
                                                                <span class="text-[10px] text-slate-500">{new Date(post.updated_at).toLocaleDateString()}</span>
                                                            </div>
                                                            
                                                            {post.favorite_quote && (
                                                                <div class="bg-slate-950/40 p-4 rounded-xl border-l-2 border-brand-500 italic text-sm text-slate-300 my-2">
                                                                    "{post.favorite_quote}"
                                                                </div>
                                                            )}

                                                            {post.review_text ? (
                                                                <p class="text-sm text-slate-350 bg-slate-950/20 p-3 rounded-xl border border-slate-900">
                                                                    <span class="text-yellow-500 font-bold block mb-1">Rated {post.rating}⭐</span>
                                                                    {post.review_text}
                                                                </p>
                                                            ) : (
                                                                <p class="text-sm text-slate-400">
                                                                    Updated reading progress of <span class="text-white font-semibold">"{post.title}"</span> by {post.author} to <span class="text-brand-400 font-bold">{post.progress_percent}%</span>.
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div class="h-48 flex items-center justify-center text-slate-500 text-sm">
                                                <span>No updates on the social feed yet. Be the first to share progress!</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* BOOK CLUBS VIEW */}
                            {activeTab === 'clubs' && (
                                <div class="space-y-6 animate-fadeIn">
                                    <div class="flex justify-between items-center bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                                        <h3 class="text-lg font-bold font-outfit text-white">Virtual Book Clubs ({ageGroup.toUpperCase()})</h3>
                                        <button onClick={() => setShowCreateClubModal(true)} class="bg-brand-500 hover:bg-brand-400 text-black px-5 py-2.5 rounded-xl font-bold text-sm transition duration-300">
                                            Start Virtual Club
                                        </button>
                                    </div>

                                    {isLoading ? (
                                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} class="glass-card rounded-2xl p-6 border border-slate-800 animate-pulse flex flex-col justify-between">
                                                    <div class="space-y-3">
                                                        <div class="h-5 w-24 bg-slate-800 rounded-full"></div>
                                                        <div class="h-6 w-3/4 bg-slate-800 rounded"></div>
                                                        <div class="h-16 w-full bg-slate-850 rounded"></div>
                                                    </div>
                                                    <div class="h-10 bg-slate-800/60 rounded-xl mt-6"></div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : clubs.length > 0 ? (
                                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {clubs.map(club => (
                                                <div key={club.id} class="glass-card rounded-2xl p-6 border border-slate-800 flex flex-col justify-between relative overflow-hidden">
                                                    <div class="space-y-3">
                                                        <span class="bg-brand-500/10 text-brand-300 font-bold text-[10px] px-2.5 py-1 rounded-full uppercase border border-brand-500/20 tracking-wider">Active Room</span>
                                                        <h4 class="font-bold text-xl text-white font-outfit">{club.name}</h4>
                                                        <p class="text-sm text-slate-400 line-clamp-3">{club.description}</p>
                                                        <div class="text-xs text-slate-500">
                                                            <i class="fas fa-clock mr-1"></i> Meeting time: {club.meeting_time || 'Daily 8:00 PM'}
                                                        </div>
                                                    </div>
                                                    <div class="mt-6 border-t border-slate-800/80 pt-4 flex justify-between items-center">
                                                        <span class="text-xs text-slate-400">Created by: {club.creator_name}</span>
                                                        <button onClick={() => setActiveClubRoom(club)} class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition duration-300 flex items-center gap-1.5">
                                                            <i class="fas fa-video"></i>
                                                            Join Video Chat
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div class="h-64 flex flex-col items-center justify-center text-slate-500">
                                            <i class="fas fa-video-slash text-3xl mb-3 text-slate-650"></i>
                                            <span>No book clubs scheduled. Start one to invite readers!</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* FORUM VIEW */}
                            {activeTab === 'forum' && (
                                <div class="space-y-6 animate-fadeIn">
                                    {!activeThread ? (
                                        <>
                                            <div class="flex justify-between items-center bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                                                <h3 class="text-lg font-bold font-outfit text-white">Discussion Forum ({ageGroup.toUpperCase()})</h3>
                                                <button onClick={() => setShowCreateThreadModal(true)} class="bg-brand-500 hover:bg-brand-400 text-black px-5 py-2.5 rounded-xl font-bold text-sm transition duration-300">
                                                    New Discussion
                                                </button>
                                            </div>

                                            {isLoading ? (
                                                <div class="space-y-4">
                                                    {[1, 2, 3].map(i => (
                                                        <div key={i} class="glass-card rounded-2xl p-5 border border-slate-800 animate-pulse flex justify-between items-center">
                                                            <div class="space-y-2 flex-grow">
                                                                <div class="h-5 w-1/3 bg-slate-800 rounded"></div>
                                                                <div class="h-3 w-1/4 bg-slate-850 rounded"></div>
                                                            </div>
                                                            <div class="h-8 w-20 bg-slate-800 rounded-xl"></div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : forumThreads.length > 0 ? (
                                                <div class="space-y-4">
                                                    {forumThreads.map(thread => (
                                                        <div key={thread.id} onClick={() => viewThread(thread.id)} class="glass-card rounded-2xl p-5 border border-slate-800 hover:border-slate-700 cursor-pointer flex justify-between items-center transition duration-300">
                                                            <div class="space-y-1.5 flex-grow pr-4">
                                                                <h4 class="font-bold text-lg text-white font-outfit hover:text-brand-400 transition">{thread.title}</h4>
                                                                <p class="text-xs text-slate-400">Created by {thread.author_name} • {new Date(thread.created_at).toLocaleDateString()}</p>
                                                            </div>
                                                            <div class="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-xl text-xs text-slate-350 border border-slate-800">
                                                                <i class="fas fa-comment-alt text-brand-400"></i>
                                                                <span>{thread.reply_count} replies</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div class="h-64 flex flex-col items-center justify-center text-slate-500">
                                                    <i class="fas fa-comments-slash text-3xl mb-3 text-slate-650"></i>
                                                    <span>No topics listed here yet. Start a conversation!</span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        /* Thread Detail view */
                                        <div class="space-y-6">
                                            <button onClick={() => setActiveThread(null)} class="text-slate-400 hover:text-white font-bold flex items-center gap-2 transition duration-300">
                                                <i class="fas fa-arrow-left text-xs"></i> Back to forums
                                            </button>

                                            <div class="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
                                                <div class="flex gap-4 border-b border-slate-800 pb-4">
                                                    <div class="w-10 h-10 rounded-full bg-slate-800 border border-slate-750 flex-shrink-0">
                                                        <img src={activeThread.thread.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=book'} class="w-full h-full rounded-full" />
                                                    </div>
                                                    <div>
                                                        <h3 class="text-xl font-bold font-outfit text-white">{activeThread.thread.title}</h3>
                                                        <p class="text-xs text-slate-400">By {activeThread.thread.author_name} • {new Date(activeThread.thread.created_at).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <p class="text-sm text-slate-300 whitespace-pre-wrap">{activeThread.thread.content}</p>
                                            </div>

                                            {/* Replies */}
                                            <div class="space-y-4">
                                                <h4 class="font-bold text-lg font-outfit">Replies ({activeThread.replies.length})</h4>
                                                {activeThread.replies.map(rep => (
                                                    <div key={rep.id} class="glass-card rounded-2xl p-5 border border-slate-800 flex gap-4">
                                                        <div class="w-8 h-8 rounded-full bg-slate-800 border border-slate-750 flex-shrink-0">
                                                            <img src={rep.avatar_url} class="w-full h-full rounded-full" />
                                                        </div>
                                                        <div class="space-y-1">
                                                            <div class="flex justify-between items-center">
                                                                <span class="font-bold text-xs text-white">{rep.author_name}</span>
                                                                <span class="text-[10px] text-slate-500">{new Date(rep.created_at).toLocaleDateString()}</span>
                                                            </div>
                                                            <p class="text-sm text-slate-300">{rep.content}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Reply form */}
                                            <form onSubmit={handlePostReply} class="glass-card p-5 rounded-2xl border border-slate-800 space-y-4">
                                                <h4 class="font-semibold text-sm">Post a reply</h4>
                                                <textarea placeholder="Write your reply content..." value={replyContent} onChange={(e) => setReplyContent(e.target.value)} required rows="3" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500"></textarea>
                                                <button type="submit" class="bg-brand-500 hover:bg-brand-400 text-black font-bold px-5 py-2 rounded-xl text-xs transition duration-300">
                                                    Post Reply
                                                </button>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            )}

                         </main>
                    ) : (
                        /* Standard guest call-to-action view */
                        <main class="flex-grow flex flex-col items-center justify-center max-w-2xl mx-auto text-center px-6">
                            <h1 class="text-5xl font-black font-outfit text-white leading-tight mb-4">The Complete Social Reading Community</h1>
                            <p class="text-slate-400 text-lg mb-8 leading-relaxed">Securely maintain personal libraries, check reading percentages, track manga, and stream live conversations with your virtual book club.</p>
                            <button onClick={() => setShowAuthModal(true)} class="bg-brand-500 hover:bg-brand-400 text-black font-bold px-8 py-4 rounded-2xl text-base shadow-lg shadow-brand-500/10 transition duration-300">
                                Create Your Account Now
                            </button>
                        </main>
                    )}

                    {/* VIRTUAL VIDEO CHAT ROOM MODAL/WIDGET */}
                    {activeClubRoom && (
                        <VideoChatRoom club={activeClubRoom} onClose={() => setActiveClubRoom(null)} />
                    )}

                    {/* CREATE BOOK CLUB MODAL */}
                    {showCreateClubModal && (
                        <div class="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
                            <div class="glass-card rounded-3xl p-6 w-full max-w-md border border-slate-800">
                                <div class="flex justify-between items-center mb-6">
                                    <h3 class="text-xl font-bold font-outfit text-slate-100">Start Virtual Book Club</h3>
                                    <button onClick={() => setShowCreateClubModal(false)} class="text-slate-400 hover:text-slate-200"><i class="fas fa-times"></i></button>
                                </div>
                                <form onSubmit={handleCreateClub} class="space-y-4">
                                    <div>
                                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1.5">Club Name</label>
                                        <input type="text" value={clubName} onChange={(e) => setClubName(e.target.value)} required placeholder="e.g. Tolkien Enthusiasts" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500 text-slate-100 text-sm" />
                                    </div>
                                    <div>
                                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1.5">Schedule Time</label>
                                        <input type="text" value={clubTime} onChange={(e) => setClubTime(e.target.value)} placeholder="e.g. Fridays 6:00 PM EST" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500 text-slate-100 text-sm" />
                                    </div>
                                    <div>
                                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1.5">About the Club</label>
                                        <textarea value={clubDesc} onChange={(e) => setClubDesc(e.target.value)} rows="3" placeholder="Brief details about what we will read..." class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500 text-slate-100 text-sm"></textarea>
                                    </div>
                                    <button type="submit" class="w-full bg-brand-500 hover:bg-brand-400 text-[#0f172a] font-bold py-3 rounded-xl transition duration-300">
                                        Schedule Club Meeting
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* CREATE THREAD MODAL */}
                    {showCreateThreadModal && (
                        <div class="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
                            <div class="glass-card rounded-3xl p-6 w-full max-w-md border border-slate-800">
                                <div class="flex justify-between items-center mb-6">
                                    <h3 class="text-xl font-bold font-outfit text-slate-100">Create New Discussion Topic</h3>
                                    <button onClick={() => setShowCreateThreadModal(false)} class="text-slate-400 hover:text-slate-200"><i class="fas fa-times"></i></button>
                                </div>
                                <form onSubmit={handleCreateThread} class="space-y-4">
                                    <div>
                                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1.5">Topic Title</label>
                                        <input type="text" value={threadTitle} onChange={(e) => setThreadTitle(e.target.value)} required placeholder="e.g. Thoughts on the Harry Potter finale?" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500 text-slate-100 text-sm" />
                                    </div>
                                    <div>
                                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1.5">Topic Body</label>
                                        <textarea value={threadContent} onChange={(e) => setThreadContent(e.target.value)} required rows="4" placeholder="Type topic details here..." class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500 text-slate-100 text-sm"></textarea>
                                    </div>
                                    <button type="submit" class="w-full bg-brand-500 hover:bg-brand-400 text-[#0f172a] font-bold py-3 rounded-xl transition duration-300">
                                        Post Discussion Thread
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* CORE USER AUTHENTICATION / SIGNIN MODAL */}
                    {showAuthModal && (
                        <div class="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 overflow-y-auto">
                            <div class="glass-card rounded-3xl p-8 w-full max-w-md border border-slate-800 shadow-2xl relative">
                                <button onClick={() => setShowAuthModal(false)} class="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors duration-150 p-2 rounded-lg hover:bg-slate-800/50" aria-label="Close modal">
                                    <i class="fas fa-times text-lg"></i>
                                </button>
                                <div class="text-center mb-8">
                                    <h2 class="text-3xl font-extrabold font-outfit text-slate-100">Welcome to BookHaven</h2>
                                    <p class="text-slate-450 text-xs mt-1">Manage reading logs, social reviews and Virtual book clubs</p>
                                </div>

                                {errorMsg && (
                                    <div class="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl mb-4 text-center">
                                        {errorMsg}
                                    </div>
                                )}

                                <form onSubmit={handleAuthSubmit} class="space-y-4">
                                        {/* Username (only on registration) */}
                                        {authMode === 'register' && (
                                            <div>
                                                <label class="block text-xs font-bold uppercase text-slate-400 mb-1.5">Username</label>
                                                <input type="text" value={regUsername} onChange={(e) => setRegUsername(e.target.value)} required placeholder="John Doe" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500 text-slate-100 text-sm" />
                                            </div>
                                        )}

                                        {/* Identifier: Mobile or Email */}
                                        <div>
                                            <label class="block text-xs font-bold uppercase text-slate-400 mb-1.5">Email or Mobile Number</label>
                                            <input type="text" value={authIdentifier} onChange={(e) => setAuthIdentifier(e.target.value)} required placeholder="you@example.com or +1234567890" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500 text-slate-100 text-sm" />
                                        </div>

                                        {/* Age Classification (only on registration) */}
                                        {authMode === 'register' && (
                                            <div>
                                                <label class="block text-xs font-bold uppercase text-slate-400 mb-1.5">Age Classification</label>
                                                <select value={regAgeGroup} onChange={(e) => setRegAgeGroup(e.target.value)} class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500 text-slate-100 text-sm h-11">
                                                    <option value="ya">Young Adult</option>
                                                    <option value="adult">Adult (18+)</option>
                                                </select>
                                            </div>
                                        )}

                                        {/* Action Button */}
                                        <button type="submit" disabled={otpLoading} class="w-full bg-brand-500 hover:bg-brand-400 disabled:bg-brand-500/40 text-[#0f172a] font-bold py-3 rounded-xl text-sm transition duration-300 mt-2 shadow-lg shadow-brand-500/10 flex items-center justify-center gap-2">
                                            {otpLoading ? (
                                                <i class="fas fa-circle-notch fa-spin"></i>
                                            ) : authMode === 'login' ? (
                                                'Sign In'
                                            ) : (
                                                'Create Account'
                                            )}
                                        </button>

                                        <div class="text-center mt-6">
                                            <button type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); }} class="text-brand-400 hover:text-brand-300 text-xs font-semibold">
                                                {authMode === 'login' ? 'Need an account? Sign Up' : 'Already registered? Sign In'}
                                            </button>
                                        </div>
                                    </form>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);

        // Register Service Worker for offline capabilities
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('BookHaven Service Worker registered successfully', reg.scope))
                    .catch(err => console.error('Service Worker registration failed', err));
            });
        }
    </script>
</body>
</html>

`;
}
