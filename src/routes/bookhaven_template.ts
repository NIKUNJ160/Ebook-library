export function renderBookHaven(): string {
    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BookHaven — Social eBook Collection & Community</title>
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <!-- FontAwesome Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <!-- Tailwind CSS Play CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        brand: {
                            50: '#fffbeb',
                            100: '#fef3c7',
                            200: '#fde68a',
                            300: '#fcd34d',
                            400: '#fbbf24',
                            500: '#f59e0b',
                            600: '#d97706',
                            700: '#b45309',
                            800: '#92400e',
                            900: '#78350f',
                            950: '#451a03',
                        },
                        darkBg: '#0f172a',
                        darkCard: '#1e293b',
                        darkBorder: '#334155'
                    },
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                        outfit: ['Outfit', 'sans-serif']
                    }
                }
            }
        }
    </script>
    <style>
        body {
            background-color: #0f172a;
            color: #f8fafc;
            font-family: 'Inter', sans-serif;
            overflow-x: hidden;
        }
        /* Custom scrollbar */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        ::-webkit-scrollbar-track {
            background: #0f172a;
        }
        ::-webkit-scrollbar-thumb {
            background: #334155;
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #475569;
        }
        /* Glassmorphism classes */
        .glass-card {
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .glass-nav {
            background: rgba(15, 23, 42, 0.8);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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
            border: 2px solid #1e293b;
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
                    <div class="fixed inset-0 bg-slate-950/90 z-50 flex flex-col p-6 overflow-y-auto">
                        <div class="flex justify-between items-center mb-6">
                            <div>
                                <span class="bg-brand-500 text-slate-950 font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider">Live Virtual Club</span>
                                <h2 class="text-2xl font-bold font-outfit mt-1">{club.name} Discussion</h2>
                            </div>
                            <button onClick={() => {
                                if (stream) stream.getTracks().forEach(track => track.stop());
                                onClose();
                            }} class="bg-slate-800 hover:bg-slate-700 text-white font-bold p-3 rounded-full transition duration-300">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow">
                            {/* Local Video Stream */}
                            <div class="glass-card rounded-2xl overflow-hidden relative aspect-video flex items-center justify-center bg-slate-900 border-2 border-brand-500/50">
                                <video ref={localVideoRef} autoPlay playsInline muted class="w-full h-full object-cover"></video>
                                <div class="absolute bottom-4 left-4 bg-slate-950/70 backdrop-blur-md text-white px-3 py-1 rounded-lg text-xs font-semibold">
                                    You (Local Feed)
                                </div>
                            </div>
                            
                            {/* Simulated Peer Feed 1 */}
                            <div class="glass-card rounded-2xl overflow-hidden relative aspect-video flex flex-col items-center justify-center bg-slate-850">
                                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop" class="w-full h-full object-cover opacity-80" />
                                <div class="absolute bottom-4 left-4 bg-slate-950/70 backdrop-blur-md text-white px-3 py-1 rounded-lg text-xs font-semibold">
                                    Sarah Jenkins
                                </div>
                            </div>

                            {/* Simulated Peer Feed 2 */}
                            <div class="glass-card rounded-2xl overflow-hidden relative aspect-video flex flex-col items-center justify-center bg-slate-850">
                                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop" class="w-full h-full object-cover opacity-80" />
                                <div class="absolute bottom-4 left-4 bg-slate-950/70 backdrop-blur-md text-white px-3 py-1 rounded-lg text-xs font-semibold">
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
                                <button class="bg-brand-500 hover:bg-brand-400 text-slate-950 px-6 py-3 rounded-xl font-bold transition duration-300">Send</button>
                            </div>
                        </div>
                    </div>
                );
            }

            return (
                <div class="min-h-screen flex flex-col bg-slate-950 text-slate-100">
                    {/* Header */}
                    <header class="glass-nav sticky top-0 z-40 px-6 py-4 flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <div class="bg-brand-500 text-slate-950 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
                                <i class="fas fa-book-open text-lg"></i>
                            </div>
                            <span class="text-2xl font-black tracking-tight font-outfit bg-gradient-to-r from-white via-slate-200 to-brand-400 bg-clip-text text-transparent">BookHaven</span>
                        </div>

                        {/* Middle Controls (YA vs Adult Toggle) */}
                        {auth && (
                            <div class="flex bg-slate-900 border border-slate-700/50 rounded-xl p-1">
                                <button onClick={() => setAgeGroup('ya')} class={\`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition duration-350 \${ageGroup === 'ya' ? 'bg-brand-500 text-slate-950' : 'text-slate-400 hover:text-white'}\`}>
                                    Young Adult
                                </button>
                                <button onClick={() => setAgeGroup('adult')} class={\`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition duration-350 \${ageGroup === 'adult' ? 'bg-brand-500 text-slate-950' : 'text-slate-400 hover:text-white'}\`}>
                                    Adult (18+)
                                </button>
                            </div>
                        )}

                        {/* Right side controls */}
                        <div class="flex items-center gap-4">
                            {auth ? (
                                <div class="flex items-center gap-4">
                                    
                                    {/* Notifications Button */}
                                    <div class="relative">
                                        <button onClick={() => setShowNotifications(!showNotifications)} class="relative p-2 text-slate-400 hover:text-white transition duration-300">
                                            <i class="fas fa-bell text-lg"></i>
                                            <span class="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                                        </button>
                                        
                                        {showNotifications && (
                                            <div class="absolute right-0 mt-3 w-80 glass-card rounded-2xl shadow-xl p-4 z-50 text-sm">
                                                <h4 class="font-bold border-b border-slate-800 pb-2 mb-3">Notification Inbox</h4>
                                                <div class="space-y-3">
                                                    <div class="flex gap-3">
                                                        <div class="w-2 h-2 mt-1.5 bg-brand-500 rounded-full flex-shrink-0"></div>
                                                        <p class="text-slate-300"><span class="text-white font-semibold">Sarah Jenkins</span> joined the Fantasy Expedition book club room.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* User Profiling */}
                                    <div class="flex items-center gap-3">
                                        <div class="w-9 h-9 rounded-full bg-slate-800 online-dot relative border border-slate-700">
                                            <img src={auth.user?.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=book'} class="w-full h-full rounded-full" />
                                        </div>
                                        <div class="hidden md:block">
                                            <div class="text-sm font-semibold text-white">{auth.user?.username}</div>
                                            <div class="text-xs text-slate-400 capitalize">{auth.user?.provider} reader</div>
                                        </div>
                                        <button onClick={handleLogout} class="text-slate-400 hover:text-red-400 text-sm p-2 transition duration-300" title="Logout">
                                            <i class="fas fa-sign-out-alt"></i>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => setShowAuthModal(true)} class="bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold px-5 py-2 rounded-xl transition duration-350 shadow-md shadow-brand-500/10 text-sm">
                                    Get Started
                                </button>
                            )}
                        </div>
                    </header>

                    {/* Navigation Tabs */}
                    {auth && (
                        <div class="bg-slate-900/35 border-b border-slate-800/80 px-6 py-2 flex flex-wrap gap-2 text-sm justify-center sm:justify-start">
                            {[
                                { id: 'home', label: 'Dashboard', icon: 'fa-chart-pie' },
                                { id: 'library', label: 'My Library', icon: 'fa-books' },
                                { id: 'discover', label: 'Discover Catalogue', icon: 'fa-search' },
                                { id: 'manga', label: 'Manga Hub', icon: 'fa-book-open-reader' },
                                { id: 'social', label: 'Social Feed', icon: 'fa-rss' },
                                { id: 'clubs', label: 'Book Clubs', icon: 'fa-users' },
                                { id: 'forum', label: 'Forums', icon: 'fa-comments' }
                            ].map(tab => (
                                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setActiveThread(null); }} class={'flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition duration-350 ' + (activeTab === tab.id ? 'bg-slate-800 text-white shadow-sm border border-slate-700/60' : 'text-slate-400 hover:text-slate-200')}>
                                    <i class={'fas ' + tab.icon + ' text-xs text-brand-400'}></i>
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* App Core Views */}
                    {auth ? (
                        <main class="flex-grow p-6 md:p-8 max-w-7xl mx-auto w-full">
                            
                            {/* HOME/DASHBOARD VIEW */}
                            {activeTab === 'home' && (
                                <div class="space-y-8 animate-fadeIn">
                                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        
                                        {/* Profile Card */}
                                        <div class="glass-card rounded-2xl p-6 flex flex-col justify-between">
                                            <div>
                                                <h3 class="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Active Reader Profile</h3>
                                                <div class="flex items-center gap-4 mt-3">
                                                    <div class="w-14 h-14 bg-slate-800 rounded-2xl border border-slate-700 p-1">
                                                        <img src={auth.user?.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=book'} class="w-full h-full rounded-xl" />
                                                    </div>
                                                    <div>
                                                        <h2 class="text-xl font-bold font-outfit text-white">{auth.user?.username}</h2>
                                                        <p class="text-xs text-slate-400">Library: {library.length} books</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="mt-6 border-t border-slate-800/80 pt-4 flex justify-between items-center">
                                                <span class="text-xs text-slate-400">Content preference:</span>
                                                <span class="bg-brand-500/20 text-brand-300 text-xs font-bold px-3 py-1 rounded-full border border-brand-500/30 uppercase tracking-wide">{ageGroup}</span>
                                            </div>
                                        </div>

                                        {/* Progress Widget */}
                                        <div class="glass-card rounded-2xl p-6">
                                            <h3 class="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Current Progress</h3>
                                            {library.filter(b => b.status === 'reading').length > 0 ? (
                                                <div class="space-y-4">
                                                    {library.filter(b => b.status === 'reading').slice(0, 2).map(book => (
                                                        <div key={book.id} class="bg-slate-900/60 p-4 rounded-xl border border-slate-850">
                                                            <div class="flex justify-between items-start mb-2">
                                                                <h4 class="font-bold text-sm text-white line-clamp-1">{book.title}</h4>
                                                                <span class="text-xs text-brand-400 font-bold">{book.progress_percent}%</span>
                                                            </div>
                                                            <div class="w-full bg-slate-800 rounded-full h-2">
                                                                <div class="bg-brand-500 h-2 rounded-full" style={{ width: \`\${book.progress_percent}%\` }}></div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div class="h-32 flex flex-col items-center justify-center text-slate-500 text-sm">
                                                    <i class="fas fa-book-reader text-2xl mb-2 text-slate-600"></i>
                                                    <span>No active reads. Start a book from your Library!</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Reading Challenges widget */}
                                        <div class="glass-card rounded-2xl p-6">
                                            <h3 class="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Reading Challenges</h3>
                                            <div class="space-y-4">
                                                {challenges.slice(0, 2).map(ch => (
                                                    <div key={ch.id} class="bg-slate-900/60 p-4 rounded-xl border border-slate-850">
                                                        <div class="flex justify-between items-center mb-1">
                                                            <h4 class="font-semibold text-sm text-white">{ch.title}</h4>
                                                            {ch.joined ? (
                                                                <span class="text-xs text-slate-400 font-bold">{ch.books_read || 0} / {ch.target_count} books</span>
                                                            ) : (
                                                                <button onClick={() => joinChallenge(ch.id)} class="text-xs bg-brand-500 text-slate-950 px-2 py-1 rounded font-bold hover:bg-brand-400">Join</button>
                                                            )}
                                                        </div>
                                                        {ch.joined && (
                                                            <div class="w-full bg-slate-800 rounded-full h-1.5 mt-2">
                                                                <div class="bg-emerald-500 h-1.5 rounded-full" style={{ width: \`\${Math.min(100, ((ch.books_read || 0) / ch.target_count) * 100)}%\` }}></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Customized Suggestions Section */}
                                    <div class="space-y-4">
                                        <div class="flex justify-between items-center">
                                            <div>
                                                <h3 class="text-xl font-bold font-outfit text-white">Recommended for You</h3>
                                                <p class="text-xs text-slate-400">Based on your age group ({ageGroup.toUpperCase()}) and reading metrics</p>
                                            </div>
                                        </div>
                                        
                                        <div class="grid grid-cols-2 md:grid-cols-6 gap-4">
                                            {suggestions.map(book => (
                                                <div key={book.id} class="glass-card rounded-xl p-4 flex flex-col justify-between hover:scale-105 transition duration-300">
                                                    <div class="aspect-[3/4] rounded-lg overflow-hidden bg-slate-800 mb-3 border border-slate-700 relative">
                                                        <img src={book.cover_url} class="w-full h-full object-cover" />
                                                        <span class="absolute top-2 right-2 bg-slate-950/85 text-[10px] font-bold px-2 py-0.5 rounded-full text-brand-400">{book.genre}</span>
                                                    </div>
                                                    <div>
                                                        <h4 class="font-bold text-sm text-white line-clamp-1">{book.title}</h4>
                                                        <p class="text-xs text-slate-400 mb-3">{book.author}</p>
                                                        <button onClick={() => addToLibrary(book.id)} class="w-full bg-slate-800 hover:bg-slate-700 text-white py-1.5 rounded-lg text-xs font-semibold transition">
                                                            + Add Library
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
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
                                                <button key={status} onClick={() => setFilterStatus(status)} class={\`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition duration-300 \${filterStatus === status ? 'bg-brand-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-750'}\`}>
                                                    {status.replace(/_/g, ' ')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {library.length > 0 ? (
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
                                                                <span class="absolute top-3 right-3 bg-brand-500 text-slate-950 font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">{book.status}</span>
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
                                    <div class="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                                        <div class="relative w-full sm:w-72">
                                            <input type="text" placeholder="Search entire catalog..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} class="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 pl-10 w-full focus:outline-none focus:border-brand-500 text-sm" />
                                            <i class="fas fa-search absolute left-3.5 top-3.5 text-slate-400 text-xs"></i>
                                        </div>
                                        <button onClick={() => setShowCreateListingModal(true)} class="bg-brand-500 hover:bg-brand-400 text-slate-950 px-6 py-2.5 rounded-xl font-bold text-sm transition duration-300 shadow-lg shadow-brand-500/10">
                                            List Book for Sale/Trade
                                        </button>
                                    </div>

                                    {/* Main Catalogue */}
                                    <div class="space-y-4">
                                        <h3 class="text-xl font-bold font-outfit text-white">General Directory ({ageGroup.toUpperCase()})</h3>
                                        <div class="grid grid-cols-2 md:grid-cols-6 gap-6">
                                            {catalogue
                                                .filter(b => b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.author.toLowerCase().includes(searchQuery.toLowerCase()))
                                                .map(book => (
                                                    <div key={book.id} class="glass-card rounded-2xl p-4 flex flex-col justify-between border border-slate-800 hover:scale-103 transition duration-300">
                                                        <div>
                                                            <div class="aspect-[3/4] rounded-xl overflow-hidden bg-slate-800 mb-3 border border-slate-750">
                                                                <img src={book.cover_url} class="w-full h-full object-cover" />
                                                            </div>
                                                            <h4 class="font-bold text-sm text-white line-clamp-1">{book.title}</h4>
                                                            <p class="text-xs text-slate-400 mt-0.5 mb-3">{book.author}</p>
                                                        </div>
                                                        <button onClick={() => addToLibrary(book.id)} class="w-full bg-brand-500/20 hover:bg-brand-500 text-brand-300 hover:text-slate-950 py-2 rounded-xl text-xs font-bold transition duration-300">
                                                            Add to Library
                                                        </button>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* MANGA HUB VIEW */}
                            {activeTab === 'manga' && (
                                <div class="space-y-8 animate-fadeIn">
                                    <div class="bg-gradient-to-r from-brand-900/30 via-slate-900/80 to-slate-900/40 p-6 rounded-3xl border border-brand-500/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                        <div>
                                            <span class="bg-brand-500 text-slate-950 font-bold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">Manga & Manhua Hub</span>
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
                                            <div class="glass-card rounded-2xl p-5 border border-slate-800 space-y-4">
                                                <h3 class="font-bold text-sm font-outfit uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2"><i class="fas fa-filter text-brand-400 mr-2"></i>Genres</h3>
                                                <div class="flex flex-wrap gap-2">
                                                    {['all', 'Action', 'Fantasy', 'Romance', 'Drama', 'Adventure', 'Comedy', 'Mystery', 'Historical', 'Supernatural'].map(g => (
                                                        <button key={g} onClick={() => setMangaGenre(g)} class={mangaGenre === g ? 'px-3 py-1.5 rounded-lg text-[10px] font-semibold transition bg-brand-500 text-slate-950 font-bold' : 'px-3 py-1.5 rounded-lg text-[10px] font-semibold transition bg-slate-800 hover:bg-slate-750 text-slate-355'}>
                                                            {g}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Filter by Tag */}
                                            <div class="glass-card rounded-2xl p-5 border border-slate-800 space-y-4">
                                                <h3 class="font-bold text-sm font-outfit uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2"><i class="fas fa-tags text-brand-400 mr-2"></i>Tags</h3>
                                                <div class="flex flex-wrap gap-2">
                                                    {['all', 'Reincarnation', 'Isekai', 'Webtoon', 'Slice of Life', 'Crime', 'Thriller'].map(t => (
                                                        <button key={t} onClick={() => setMangaTag(t)} class={mangaTag === t ? 'px-3 py-1.5 rounded-lg text-[10px] font-semibold transition bg-brand-500 text-slate-950 font-bold' : 'px-3 py-1.5 rounded-lg text-[10px] font-semibold transition bg-slate-800 hover:bg-slate-750 text-slate-355'}>
                                                            {t}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Filter by Author */}
                                            <div class="glass-card rounded-2xl p-5 border border-slate-800 space-y-4">
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
                                                        return (
                                                            <div key={manga.id} class="glass-card rounded-2xl p-4 flex flex-col justify-between border border-slate-800 hover:scale-103 transition duration-300">
                                                                <div>
                                                                    <div class="aspect-[3/4] rounded-xl overflow-hidden bg-slate-850 mb-3 border border-slate-750 relative shadow-inner">
                                                                        <img src={manga.cover_url} class="w-full h-full object-cover" />
                                                                        <span class="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur-sm text-[9px] font-bold px-2 py-0.5 rounded text-brand-300">{manga.category.toUpperCase()}</span>
                                                                    </div>
                                                                    <h4 class="font-bold text-sm text-white line-clamp-1 font-outfit" title={manga.title}>{manga.title}</h4>
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
                                                                    <button onClick={() => addToLibrary(manga.id)} class="w-full bg-brand-500 hover:bg-brand-400 text-slate-950 py-2 rounded-xl text-xs font-bold transition duration-300">
                                                                        Add to Library
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    </div>
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
                                        <button onClick={() => setShowCreateClubModal(true)} class="bg-brand-500 hover:bg-brand-400 text-slate-950 px-5 py-2.5 rounded-xl font-bold text-sm transition duration-300">
                                            Start Virtual Club
                                        </button>
                                    </div>

                                    {clubs.length > 0 ? (
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
                                                <button onClick={() => setShowCreateThreadModal(true)} class="bg-brand-500 hover:bg-brand-400 text-slate-950 px-5 py-2.5 rounded-xl font-bold text-sm transition duration-300">
                                                    New Discussion
                                                </button>
                                            </div>

                                            {forumThreads.length > 0 ? (
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
                                                <button type="submit" class="bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs transition duration-300">
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
                            <button onClick={() => setShowAuthModal(true)} class="bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold px-8 py-4 rounded-2xl text-base shadow-lg shadow-brand-500/10 transition duration-300">
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
                        <div class="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
                            <div class="glass-card rounded-3xl p-6 w-full max-w-md border border-slate-800">
                                <div class="flex justify-between items-center mb-6">
                                    <h3 class="text-xl font-bold font-outfit text-white">Start Virtual Book Club</h3>
                                    <button onClick={() => setShowCreateClubModal(false)} class="text-slate-400 hover:text-white"><i class="fas fa-times"></i></button>
                                </div>
                                <form onSubmit={handleCreateClub} class="space-y-4">
                                    <div>
                                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1.5">Club Name</label>
                                        <input type="text" value={clubName} onChange={(e) => setClubName(e.target.value)} required placeholder="e.g. Tolkien Enthusiasts" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500 text-white text-sm" />
                                    </div>
                                    <div>
                                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1.5">Schedule Time</label>
                                        <input type="text" value={clubTime} onChange={(e) => setClubTime(e.target.value)} placeholder="e.g. Fridays 6:00 PM EST" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500 text-white text-sm" />
                                    </div>
                                    <div>
                                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1.5">About the Club</label>
                                        <textarea value={clubDesc} onChange={(e) => setClubDesc(e.target.value)} rows="3" placeholder="Brief details about what we will read..." class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500 text-white text-sm"></textarea>
                                    </div>
                                    <button type="submit" class="w-full bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold py-3 rounded-xl transition duration-300">
                                        Schedule Club Meeting
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* CREATE THREAD MODAL */}
                    {showCreateThreadModal && (
                        <div class="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
                            <div class="glass-card rounded-3xl p-6 w-full max-w-md border border-slate-800">
                                <div class="flex justify-between items-center mb-6">
                                    <h3 class="text-xl font-bold font-outfit text-white">Create New Discussion Topic</h3>
                                    <button onClick={() => setShowCreateThreadModal(false)} class="text-slate-400 hover:text-white"><i class="fas fa-times"></i></button>
                                </div>
                                <form onSubmit={handleCreateThread} class="space-y-4">
                                    <div>
                                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1.5">Topic Title</label>
                                        <input type="text" value={threadTitle} onChange={(e) => setThreadTitle(e.target.value)} required placeholder="e.g. Thoughts on the Harry Potter finale?" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500 text-white text-sm" />
                                    </div>
                                    <div>
                                        <label class="block text-xs font-bold uppercase text-slate-400 mb-1.5">Topic Body</label>
                                        <textarea value={threadContent} onChange={(e) => setThreadContent(e.target.value)} required rows="4" placeholder="Type topic details here..." class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500 text-white text-sm"></textarea>
                                    </div>
                                    <button type="submit" class="w-full bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold py-3 rounded-xl transition duration-300">
                                        Post Discussion Thread
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* CORE USER AUTHENTICATION / SIGNIN MODAL */}
                    {showAuthModal && (
                        <div class="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
                            <div class="glass-card rounded-3xl p-8 w-full max-w-md border border-slate-800 shadow-2xl relative">
                                <button onClick={() => setShowAuthModal(false)} class="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors duration-150 p-2 rounded-lg hover:bg-slate-800/50" aria-label="Close modal">
                                    <i class="fas fa-times text-lg"></i>
                                </button>
                                <div class="text-center mb-8">
                                    <h2 class="text-3xl font-extrabold font-outfit text-white">Welcome to BookHaven</h2>
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
                                                <input type="text" value={regUsername} onChange={(e) => setRegUsername(e.target.value)} required placeholder="John Doe" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500 text-white text-sm" />
                                            </div>
                                        )}

                                        {/* Identifier: Mobile or Email */}
                                        <div>
                                            <label class="block text-xs font-bold uppercase text-slate-400 mb-1.5">Email or Mobile Number</label>
                                            <input type="text" value={authIdentifier} onChange={(e) => setAuthIdentifier(e.target.value)} required placeholder="you@example.com or +1234567890" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500 text-white text-sm" />
                                        </div>

                                        {/* Age Classification (only on registration) */}
                                        {authMode === 'register' && (
                                            <div>
                                                <label class="block text-xs font-bold uppercase text-slate-400 mb-1.5">Age Classification</label>
                                                <select value={regAgeGroup} onChange={(e) => setRegAgeGroup(e.target.value)} class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-brand-500 text-white text-sm h-11">
                                                    <option value="ya">Young Adult</option>
                                                    <option value="adult">Adult (18+)</option>
                                                </select>
                                            </div>
                                        )}

                                        {/* Action Button */}
                                        <button type="submit" disabled={otpLoading} class="w-full bg-brand-500 hover:bg-brand-400 disabled:bg-brand-500/40 text-slate-950 font-bold py-3 rounded-xl text-sm transition duration-300 mt-2 shadow-lg shadow-brand-500/10 flex items-center justify-center gap-2">
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
