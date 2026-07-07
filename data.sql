-- Seed Data for D1 Portfolio and BookHaven Ebook Library Platform

-- 1. Seed Books Catalog
DELETE FROM books;
INSERT INTO books (id, title, author, genre, category, total_pages, cover_url) VALUES 
(1, 'The Hobbit', 'J.R.R. Tolkien', 'Fantasy', 'ya', 310, 'https://images.unsplash.com/photo-1629992101753-56d196c8aabb?w=150&auto=format&fit=crop'),
(2, 'Harry Potter and the Sorcerer Stone', 'J.K. Rowling', 'Fantasy', 'ya', 309, 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=150&auto=format&fit=crop'),
(3, 'The Hunger Games', 'Suzanne Collins', 'Dystopian', 'ya', 374, 'https://images.unsplash.com/photo-1587876931567-564ce588bfbd?w=150&auto=format&fit=crop'),
(4, 'Percy Jackson & the Olympians', 'Rick Riordan', 'Fantasy', 'ya', 377, 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=150&auto=format&fit=crop'),
(5, 'The Great Gatsby', 'F. Scott Fitzgerald', 'Classic', 'adult', 180, 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=150&auto=format&fit=crop'),
(6, 'To Kill a Mockingbird', 'Harper Lee', 'Fiction', 'adult', 281, 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=150&auto=format&fit=crop'),
(7, '1984', 'George Orwell', 'Dystopian', 'adult', 328, 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=150&auto=format&fit=crop'),
(8, 'Dune', 'Frank Herbert', 'Sci-Fi', 'adult', 412, 'https://images.unsplash.com/photo-1531988042231-d39a9cc12a9a?w=150&auto=format&fit=crop'),
(9, 'Chikyuu ni Dungeon ga Dekita to Omottara', 'Kai Neko', 'Manga, Action, Fantasy', 'ya', 200, 'https://img-r2.2xstorage.com/thumb/chikyuu-ni-dungeon-ga-dekita-to-omottara-ore-dake-isekai-e-ikeru-you-ni-natta-chikyuu-ni-wanai-jobushisutemu-to-kamikemo-no-ni-natta-kai-neko-no-chikara-de-futatsu-no-sekai-o-ikiki-shinagara-musou-suru.webp'),
(10, 'Byoujaku Shoujo, Tensei Shite Kenkou na Nikutai', 'Sato Shin', 'Manga, Fantasy, Reincarnation', 'ya', 150, 'https://img-r2.2xstorage.com/thumb/byoujaku-shoujo-tensei-shite-kenkou-na-nikutai-saikyou-wo-te-ni-ireru.webp'),
(11, 'Celeb Lady', 'Choi Ji-an', 'Manga, Romance, Drama', 'ya', 180, 'https://img-r2.2xstorage.com/thumb/celeb-lady.webp'),
(12, 'Dragon Fragment', 'Shin Hei', 'Manga, Action, Fantasy, Adventure', 'ya', 220, 'https://img-r2.2xstorage.com/thumb/dragon-fragment.webp'),
(13, 'Shikabane Kaigo', 'Nakamura Koji', 'Manga, Mystery, Drama', 'adult', 140, 'https://img-r2.2xstorage.com/thumb/shikabane-kaigo.webp'),
(14, 'Kimi wa Shuumatsu', 'Takahashi Ken', 'Manga, Drama, Slice of Life', 'ya', 130, 'https://img-r2.2xstorage.com/thumb/kimi-wa-shuumatsu.webp'),
(15, 'Return Of The Bloodthirsty Police', 'Lee Jae-heon', 'Manga, Action, Crime, Thriller', 'adult', 280, 'https://img-r2.2xstorage.com/thumb/return-of-the-bloodthirsty-police.webp'),
(16, 'The Count''s Secret Maid', 'Yoon Ha-rin', 'Manga, Romance, Mystery, Historical', 'ya', 190, 'https://img-r2.2xstorage.com/thumb/the-count-s-secret-maid.webp'),
(17, 'Gakeppuchi Kizoku no Ikinokori Senryaku', 'Yamada Taro', 'Manga, Fantasy, Comedy', 'ya', 160, 'https://img-r2.2xstorage.com/thumb/gakeppuchi-kizoku-no-ikinokori-senryaku.webp'),
(18, 'Arasaa ga VTuber ni Natta Hanashi', 'Yuuki Hiro', 'Manga, Comedy, Slice of Life', 'ya', 120, 'https://img-r2.2xstorage.com/thumb/arasaa-ga-vtuber-ni-natta-hanashi.webp'),
(19, 'Forlorn Hope ~Keishichou Battoutai Senki~', 'Asakura Ren', 'Manga, Action, Historical', 'adult', 240, 'https://img-r2.2xstorage.com/thumb/forlorn-hope-keishichou-battoutai-senki.webp'),
(20, 'Gekkou Teien', 'Kang Ji-hoon', 'Manga, Romance, Fantasy, Drama', 'adult', 210, 'https://img-r2.2xstorage.com/thumb/gekkou-teien.webp'),
(21, 'Absolute Domination at Level 0', 'Tsukimi Rui', 'Manga, Fantasy, Isekai, Action', 'ya', 170, 'https://img-r2.2xstorage.com/thumb/absolute-domination-at-level-0-using-my-analysis-skill.webp'),
(22, 'Abandoned ~Elf Weapon Smith~', 'Kato Ryo', 'Manga, Fantasy, Action', 'ya', 180, 'https://img-r2.2xstorage.com/thumb/abandoned-tsuyosugite-buki-ga-kowareru-yuusha-to-buki-shokunin-no-elf.webp'),
(23, 'Father of Three Overpowered Children', 'Kim Min-su', 'Manga, Comedy, Fantasy, Action', 'ya', 200, 'https://img-r2.2xstorage.com/thumb/father-of-three-overpowered-children.webp'),
(24, 'Extreme Flame Wizard', 'Sato Kenji', 'Manga, Comedy, Fantasy', 'ya', 150, 'https://img-r2.2xstorage.com/thumb/extreme-flame-wizard-i-can-only-use-fireballs-but-i-became-the-strongest-because-i-wholeheartedly-wanted-to-be-popular.webp'),
(25, 'Dungeon de Service Zangyou o Shite Ita', 'Katsura Yoshi', 'Manga, Comedy, Fantasy, Action', 'ya', 160, 'https://img-r2.2xstorage.com/thumb/dungeon-de-service-zangyou-o-shite-ita-dake-nanoni-sasurai-no-s-kyuu-tansakusha-to-uwasa-ni-natte-shimaimashita.webp'),
(26, 'Boy Meets Girl, Starting with a Contract', 'Park So-ra', 'Manga, Romance, Drama', 'ya', 140, 'https://img-r2.2xstorage.com/thumb/boy-meets-girl-starting-with-a-contract.webp'),
(27, 'The Princess is Now the Duke', 'Cho Hye-jin', 'Manga, Romance, Fantasy', 'ya', 175, 'https://img-r2.2xstorage.com/thumb/the-princess-is-now-the-duke.webp'),
(28, 'High School Inari Tamamo-chan!', 'Yuuki Hiro', 'Manga, Comedy, Slice of Life, Supernatural', 'ya', 135, 'https://img-r2.2xstorage.com/thumb/high-school-inari-tamamo-chan.webp');

-- 2. Seed Reading Challenges
DELETE FROM reading_challenges;
INSERT INTO reading_challenges (id, title, description, target_count, start_date, end_date) VALUES
(1, 'Summer Reading Blitz', 'Read 3 books by the end of August', 3, '2026-07-01', '2026-08-31'),
(2, 'Fantasy Expedition', 'Explore magical worlds by reading 5 fantasy novels', 5, '2026-07-01', '2026-09-30'),
(3, 'YA Classics Challenge', 'Finish 4 young adult best sellers', 4, '2026-07-01', '2026-09-30');

-- 3. Seed Default Book Clubs
DELETE FROM book_clubs;
INSERT INTO book_clubs (id, name, description, category, meeting_time, creator_id, room_id) VALUES
(1, 'Manga Enthusiasts', 'Discuss the latest updates and translation releases', 'ya', 'Saturdays at 7:00 PM', 'system', 'manga-club'),
(2, 'Sci-Fi Explorers', 'Deep dive into space opera and dystopian futures', 'adult', 'Fridays at 8:00 PM', 'system', 'scifi-club');

-- 4. Seed Forum Threads & Replies
DELETE FROM forum_threads;
INSERT INTO forum_threads (id, title, content, category, author_id) VALUES
(1, 'Favorite Manga Artwork?', 'Which manga has the most stunning artwork style in your opinion?', 'ya', 'system'),
(2, 'Dune Part 2 discussion thread', 'Who has read the book and seen the adaptation?', 'adult', 'system');

DELETE FROM forum_replies;
INSERT INTO forum_replies (id, thread_id, author_id, content) VALUES
(1, 1, 'system', 'Personally, I love the artwork in Dragon Fragment!'),
(2, 2, 'system', 'The world-building in Dune is timeless.');
