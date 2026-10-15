/**
 * ====================================================================================
 * PROJECT: ULTIMATE DISCORD COMMUNITY, ECONOMY & LEVELING BOT
 * SERVER: AKIRA INFINITY
 * ====================================================================================
 * OWNER ID: 1493412047969587310
 * BOT ID   : 1556992283709145159
 * ====================================================================================
 */

'use strict';

require('dotenv').config();

const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ActivityType
} = require('discord.js');

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// ⚙️ KONFIGURASI BOT & ID CHANNEL AKURAT
const CONFIG = {
    BOT_INFO: {
        NAME: 'Akira Infinity Bot',
        ID: '1556992283709145159',
        OWNER_ID: '1493412047969587310',
    },
    CHANNELS: {
        WELCOME: '1551254295020703884',
        GOODBYE: '1552385836488724660',
        BOT_COMMANDS: '1460418101597180096',  // Channel khusus Bot Commands
        LEVEL_UP: '1460418101597180096',      // Channel khusus Notifikasi Level Up
        GENERAL_CHAT: '1460582020743827486',  // General Chat
        INTRO_FORM: '1544143686739296318',    // Channel #intro-form
        INTRODUCTION: '1460582020743827486'  // Channel #introduction
    },
    ROLES: {
        TOP_1_LEADERBOARD: '1461375929900073206', // Role otomatis untuk Rank 1
        MEMBER_INTRO: '1533691517372207195'       // ✅ Role otomatis setelah isi intro
    },
    SETTINGS: {
        WELCOME_TEXT: 'Selamat bergabung di **{server}**!\n\n📌 **Langkah Awal:**\n└ Silakan isi form perkenalan di {channel_intro}\n└ Tetap patuhi aturan server ya!\n\n*Semoga betah dan seru-seruan di sini!* 🚀',
        GOODBYE_TEXT: 'Sayang sekali **{username}** telah meninggalkan server **{server}**.\nTerima kasih atas kebersamaannya dan kenangan manisnya! 😢',
        WELCOME_BANNER: 'https://i.ibb.co/30Z1H4y/welcome-banner.gif',
        GOODBYE_BANNER: 'https://i.ibb.co/VMyL0nB/goodbye-banner.gif',
        DEFAULT_ICON: 'https://i.imgur.com/8Qe5g6z.png',
        GREET_PAGI: 'Selamat Pagi ☀️',
        GREET_SIANG: 'Selamat Siang 🌤️',
        GREET_SORE: 'Selamat Sore 🌅',
        GREET_MALAM: 'Selamat Malam 🌙'
    },
    ECONOMY: {
        DAILY_REWARD: 2500,
        BASE_STARTING_BALANCE: 500,
        LEVEL_UP_MULTIPLIER: 500,
        EXP_COOLDOWN_MS: 30000,
        WORK_COOLDOWN_MS: 3600000
    },
    COLORS: {
        PRIMARY: '#5865F2',
        SUCCESS: '#2ECC71',
        WARNING: '#F1C40F',
        DANGER: '#E74C3C',
        PURPLE: '#9B59B6',
        GOLD: '#FFD700',
        INFO: '#3498DB'
    }
};

// 🗄️ DATABASE SETUP
const dbPath = path.resolve(__dirname, 'economy.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('❌ Gagal membuka database:', err.message);
    else console.log('✅ Database SQLite terhubung.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        userId TEXT PRIMARY KEY,
        balance INTEGER DEFAULT 500,
        lastDaily TEXT,
        job TEXT DEFAULT 'pengangguran',
        lastWork TEXT,
        level INTEGER DEFAULT 1,
        exp INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS bot_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`, () => {
        db.all(`SELECT * FROM bot_settings`, [], (err, rows) => {
            if (!err && rows) {
                rows.forEach(row => {
                    if (CONFIG.SETTINGS[row.key] !== undefined) {
                        CONFIG.SETTINGS[row.key] = row.value;
                    }
                });
            }
        });
    });
});

function setBotSetting(key, value) {
    CONFIG.SETTINGS[key] = value;
    db.run(`INSERT OR REPLACE INTO bot_settings (key, value) VALUES (?, ?)`, [key, value]);
}

class DatabaseService {
    static getUser(userId) {
        return new Promise((resolve) => {
            db.get(`SELECT * FROM users WHERE userId = ?`, [userId], (err, row) => {
                if (err || !row) {
                    db.run(`INSERT INTO users (userId) VALUES (?)`, [userId], () => {
                        resolve({
                            userId,
                            balance: CONFIG.ECONOMY.BASE_STARTING_BALANCE,
                            lastDaily: null,
                            job: 'pengangguran',
                            lastWork: null,
                            level: 1,
                            exp: 0
                        });
                    });
                } else {
                    resolve(row);
                }
            });
        });
    }

    static updateBalance(userId, amount) {
        return new Promise((resolve) => {
            db.get(`SELECT balance FROM users WHERE userId = ?`, [userId], (err, row) => {
                if (!row) {
                    db.run(`INSERT INTO users (userId, balance) VALUES (?, ?)`, [userId, Math.max(0, amount)], () => resolve(amount));
                } else {
                    let newBal = Math.max(0, row.balance + amount);
                    db.run(`UPDATE users SET balance = ? WHERE userId = ?`, [newBal, userId], () => resolve(newBal));
                }
            });
        });
    }

    static setJob(userId, jobName) {
        return new Promise((resolve) => {
            db.run(`UPDATE users SET job = ? WHERE userId = ?`, [jobName, userId], () => resolve());
        });
    }

    static setLastWork(userId, timestamp) {
        return new Promise((resolve) => {
            db.run(`UPDATE users SET lastWork = ? WHERE userId = ?`, [timestamp, userId], () => resolve());
        });
    }

    static setLastDaily(userId, timestamp) {
        return new Promise((resolve) => {
            db.run(`UPDATE users SET lastDaily = ? WHERE userId = ?`, [timestamp, userId], () => resolve());
        });
    }

    static updateLevelAndExp(userId, level, exp) {
        return new Promise((resolve) => {
            db.run(`UPDATE users SET level = ?, exp = ? WHERE userId = ?`, [level, exp, userId], () => resolve());
        });
    }

    static resetUserExp(userId) {
        return new Promise((resolve) => {
            db.run(`UPDATE users SET level = 1, exp = 0 WHERE userId = ?`, [userId], () => resolve());
        });
    }

    static resetAllExp() {
        return new Promise((resolve) => {
            db.run(`UPDATE users SET level = 1, exp = 0`, () => resolve());
        });
    }

    static getLeaderboard(limit = 10) {
        return new Promise((resolve) => {
            db.all(`SELECT userId, level, exp FROM users ORDER BY level DESC, exp DESC LIMIT ?`, [limit], (err, rows) => {
                if (err) resolve([]);
                else resolve(rows || []);
            });
        });
    }
}

const JOBS = Object.freeze({
    petani: { name: 'Petani', gaji: 350, desc: 'Menanam padi & merawat tanaman kebun.' },
    ojol: { name: 'Ojol', gaji: 600, desc: 'Mengantar penumpang & pesanan makanan.' },
    kantor: { name: 'Pegawai Kantor', gaji: 1200, desc: 'Menyusun laporan harian & lembur di kantor.' },
    dokter: { name: 'Dokter', gaji: 2500, desc: 'Menyembuhkan pasien darurat di rumah sakit.' },
    programmer: { name: 'Programmer', gaji: 4000, desc: 'Membuat aplikasi & membetulkan sistem server.' },
    artis: { name: 'Artis', gaji: 7500, desc: 'Syuting film & tampil konser musik panggung.' }
});

const TEBAK_KATA_QUESTIONS = Object.freeze([
    { soal: "Kendaraan beroda dua yang dikayuh menggunakan kaki", jawaban: "sepeda" },
    { soal: "Hewan mamalia raksasa yang hidup di dalam lautan luas", jawaban: "paus" },
    { soal: "Kota metropolitan yang menjadi ibu kota negara Indonesia", jawaban: "jakarta" },
    { soal: "Alat musik tradisional asal Jawa yang dimainkan dengan cara dipukul", jawaban: "gamelan" },
    { soal: "Buah berduri tajam yang dijuluki sebagai Rajanya Buah", jawaban: "durian" }
]);

const expCooldownSet = new Set();
const voiceStateMap = new Map();
const activeGameSessions = new Map();

let currentGreetingPeriod = null; 

function getCurrentPeriodKey() {
    let hour = new Date().getHours();
    if (hour >= 4 && hour < 11) return 'pagi';
    else if (hour >= 11 && hour < 15) return 'siang';
    else if (hour >= 15 && hour < 18) return 'sore';
    else return 'malam';
}

function getDynamicGreeting() {
    let period = getCurrentPeriodKey();
    if (period === 'pagi') return CONFIG.SETTINGS.GREET_PAGI || 'Selamat Pagi ☀️';
    if (period === 'siang') return CONFIG.SETTINGS.GREET_SIANG || 'Selamat Siang 🌤️';
    if (period === 'sore') return CONFIG.SETTINGS.GREET_SORE || 'Selamat Sore 🌅';
    return CONFIG.SETTINGS.GREET_MALAM || 'Selamat Malam 🌙';
}

function formatTemplateText(text, member, guild) {
    return text
        .replace(/{user}/g, `<@${member.id}>`)
        .replace(/{username}/g, member.user ? member.user.username : member.username)
        .replace(/{server}/g, guild.name)
        .replace(/{count}/g, guild.memberCount)
        .replace(/{channel_intro}/g, `<#${CONFIG.CHANNELS.INTRO_FORM}>`);
}

// FUNGSI UNTUK MEMBUAT EMBED AKIRA BOT GUIDE BESERTA DROPDOWN
function createAkiraGuideComponent(serverIcon) {
    const guideEmbed = new EmbedBuilder()
        .setColor(CONFIG.COLORS.PRIMARY)
        .setAuthor({ name: 'Akira Bot Guide', iconURL: serverIcon })
        .setTitle('Panduan Bot')
        .setDescription(
            'Selamat datang di channel panduan! Pilih topik yang ingin kamu pelajari lewat menu panduan di bawah pesan ini. ' +
            'Panduan yang muncul hanya bisa dilihat oleh kamu sendiri.\n\n' +
            'Silahkan klik menu dibawah untuk melihat daftar panduan.'
        );

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_guide_menu')
        .setPlaceholder('Menu Panduan')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('WordChain')
                .setValue('guide_wordchain')
                .setDescription('Panduan game sambung kata'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Infinity Quiz - Non Event')
                .setValue('guide_quiz')
                .setDescription('Panduan kuis tebak kata berhadiah koin'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Bot Music')
                .setValue('guide_music')
                .setDescription('Panduan lengkap cara memutar musik & radio'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Akira Economy')
                .setValue('guide_features')
                .setDescription('Tutorial lengkap fitur member, kerja & mini-games')
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return { embeds: [guideEmbed], components: [row] };
}

async function synchronizeTopRole(guild, topUserId) {
    if (!CONFIG.ROLES.TOP_1_LEADERBOARD || CONFIG.ROLES.TOP_1_LEADERBOARD === 'OFF') return;
    try {
        const role = guild.roles.cache.get(CONFIG.ROLES.TOP_1_LEADERBOARD);
        if (!role) return;

        for (const [memberId, member] of role.members) {
            if (memberId !== topUserId) {
                await member.roles.remove(role).catch(() => {});
            }
        }

        const topMember = await guild.members.fetch(topUserId).catch(() => null);
        if (topMember && !topMember.roles.cache.has(CONFIG.ROLES.TOP_1_LEADERBOARD)) {
            await topMember.roles.add(role).catch(() => {});
        }
    } catch (e) {
        console.error('Gagal sinkronisasi Top 1 Role:', e);
    }
}

async function addExpToUser(userId, amount, guild) {
    let userData = await DatabaseService.getUser(userId);
    let newExp = userData.exp + amount;
    let requiredExp = userData.level * 100;

    if (newExp >= requiredExp) {
        let newLevel = userData.level + 1;
        let rewardCoin = newLevel * CONFIG.ECONOMY.LEVEL_UP_MULTIPLIER;
        await DatabaseService.updateLevelAndExp(userId, newLevel, newExp - requiredExp);
        await DatabaseService.updateBalance(userId, rewardCoin);

        const levelUpEmbed = new EmbedBuilder()
            .setColor(CONFIG.COLORS.GOLD)
            .setTitle('🎉 CONGRATULATIONS! LEVEL UP! 🎉')
            .setDescription(
                `Selamat <@${userId}>, kamu berhasil mencapai **Level ${newLevel}**!\n\n` +
                `🎁 **Bonus Koin Level Up:** \`+${rewardCoin.toLocaleString()} Koin\``
            );

        if (guild) {
            const levelChannel = guild.channels.cache.get(CONFIG.CHANNELS.LEVEL_UP);
            if (levelChannel) {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member) levelUpEmbed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
                levelChannel.send({ embeds: [levelUpEmbed] }).catch(() => {});
            }
        }
    } else {
        await DatabaseService.updateLevelAndExp(userId, userData.level, newExp);
    }

    if (guild) {
        const topUsers = await DatabaseService.getLeaderboard(1);
        if (topUsers.length > 0) {
            synchronizeTopRole(guild, topUsers[0].userId);
        }
    }
}

client.once('ready', () => {
    console.log(`🤖 Bot online sebagai: ${client.user.tag}`);
    client.user.setPresence({
        activities: [{ name: 'AKIRA INFINITY | help', type: ActivityType.Playing }],
        status: 'online'
    });
});

// ==========================================
// 🎙️ EVENT: VOICE STATE UPDATE
// ==========================================
client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.id || oldState.id;
    if (newState.member?.user.bot) return;

    if (!oldState.channelId && newState.channelId) {
        voiceStateMap.set(userId, Date.now());
    }

    if (oldState.channelId && !newState.channelId) {
        const joinTime = voiceStateMap.get(userId);
        if (joinTime) {
            const timeSpentMs = Date.now() - joinTime;
            const minutes = Math.floor(timeSpentMs / 60000);
            voiceStateMap.delete(userId);

            if (minutes >= 1) {
                const gainedExp = minutes * 10;
                await addExpToUser(userId, gainedExp, oldState.guild);
            }
        }
    }
});

// ==========================================
// 💖 EVENT: WELCOME MEMBER
// ==========================================
client.on('guildMemberAdd', async (member) => {
    if (CONFIG.CHANNELS.WELCOME === 'OFF') return;
    const welcomeChannel = member.guild.channels.cache.get(CONFIG.CHANNELS.WELCOME);
    if (!welcomeChannel) return;

    const serverIcon = member.guild.iconURL({ dynamic: true, size: 512 }) || CONFIG.SETTINGS.DEFAULT_ICON;
    const userAvatar = member.user.displayAvatarURL({ dynamic: true, size: 512 });

    const descText = formatTemplateText(CONFIG.SETTINGS.WELCOME_TEXT, member, member.guild);

    const welcomeEmbed = new EmbedBuilder()
        .setColor(CONFIG.COLORS.SUCCESS)
        .setAuthor({ name: `WELCOME TO ${member.guild.name.toUpperCase()}!`, iconURL: serverIcon })
        .setTitle(`🎉 Halo & Selamat Datang, ${member.user.username}! 🎉`)
        .setDescription(descText)
        .setThumbnail(userAvatar)
        .setImage(CONFIG.SETTINGS.WELCOME_BANNER)
        .addFields(
            { name: '👥 Member Ke-', value: `\`#${member.guild.memberCount}\``, inline: true },
            { name: '🆔 User ID', value: `\`${member.id}\``, inline: true }
        )
        .setFooter({ text: `${member.guild.name} • Official Welcome System`, iconURL: serverIcon })
        .setTimestamp();

    welcomeChannel.send({ content: `👋 Selamat datang <@${member.id}> di **${member.guild.name}**!`, embeds: [welcomeEmbed] }).catch(() => {});
});

// ==========================================
// 💔 EVENT: GOODBYE MEMBER
// ==========================================
client.on('guildMemberRemove', async (member) => {
    if (CONFIG.CHANNELS.GOODBYE === 'OFF') return;
    const goodbyeChannel = member.guild.channels.cache.get(CONFIG.CHANNELS.GOODBYE);
    if (!goodbyeChannel) return;

    const serverIcon = member.guild.iconURL({ dynamic: true, size: 512 }) || CONFIG.SETTINGS.DEFAULT_ICON;
    const userAvatar = member.user.displayAvatarURL({ dynamic: true, size: 512 });

    const descText = formatTemplateText(CONFIG.SETTINGS.GOODBYE_TEXT, member, member.guild);

    const goodbyeEmbed = new EmbedBuilder()
        .setColor(CONFIG.COLORS.DANGER)
        .setAuthor({ name: `MEMBER LEFT — ${member.guild.name.toUpperCase()}`, iconURL: serverIcon })
        .setTitle(`😢 Sampai Jumpa, ${member.user.username}!`)
        .setDescription(descText)
        .setThumbnail(userAvatar)
        .setImage(CONFIG.SETTINGS.GOODBYE_BANNER)
        .addFields(
            { name: '👥 Sisa Member', value: `\`${member.guild.memberCount} Member\``, inline: true }
        )
        .setFooter({ text: `${member.guild.name} • Farewell System`, iconURL: serverIcon })
        .setTimestamp();

    goodbyeChannel.send({ embeds: [goodbyeEmbed] }).catch(() => {});
});

// ==========================================
// 📩 EVENT: INTERACTION CREATE (MODAL, BUTTON & DROPDOWN MENU)
// ==========================================
client.on('interactionCreate', async (interaction) => {
    // 📝 FORM INTRO MODAL
    if (interaction.isButton() && interaction.customId === 'open_identity_modal') {
        const modal = new ModalBuilder()
            .setCustomId('identity_modal_submit')
            .setTitle('Formulir Perkenalan Diri');

        const nameInput = new TextInputBuilder()
            .setCustomId('identity_nama')
            .setLabel('Nama panggilan')
            .setPlaceholder('Kamu mau dipanggil apa?')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const ageInput = new TextInputBuilder()
            .setCustomId('identity_umur')
            .setLabel('Umur?')
            .setPlaceholder('Jangan malu malu!!')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const cityInput = new TextInputBuilder()
            .setCustomId('identity_kota')
            .setLabel('Asal Kota?')
            .setPlaceholder('Gaakan kita grebek kok')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const gameInput = new TextInputBuilder()
            .setCustomId('identity_game')
            .setLabel('Game yang kamu sukai?')
            .setPlaceholder('Ayo mabar')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(ageInput),
            new ActionRowBuilder().addComponents(cityInput),
            new ActionRowBuilder().addComponents(gameInput)
        );

        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'identity_modal_submit') {
        const nama = interaction.fields.getTextInputValue('identity_nama');
        const umur = interaction.fields.getTextInputValue('identity_umur');
        const kota = interaction.fields.getTextInputValue('identity_kota');
        const game = interaction.fields.getTextInputValue('identity_game');

        const serverIcon = interaction.guild.iconURL({ dynamic: true }) || CONFIG.SETTINGS.DEFAULT_ICON;

        const resultEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ name: `PERKENALAN MEMBER — ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTitle(`✨ Halo semuanya, salam kenal dari ${nama}! ✨`)
            .setDescription(`Berikut adalah data perkenalan dari <@${interaction.user.id}>:`)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .addFields(
                { name: '👤 Nama Panggilan', value: `\`${nama}\``, inline: true },
                { name: '🎂 Umur', value: `\`${umur}\``, inline: true },
                { name: '🏙️ Asal Kota', value: `\`${kota}\``, inline: true },
                { name: '🎮 Game Favorit', value: `\`${game}\``, inline: false }
            )
            .setFooter({ text: `${interaction.guild.name} • Perkenalan Member`, iconURL: serverIcon })
            .setTimestamp();

        let targetChannel = interaction.guild.channels.cache.get(CONFIG.CHANNELS.INTRODUCTION) || interaction.channel;

        // 🏷️ OTOMATIS BERIKAN ROLE MEMBER SETELAH ISI INTRO
        if (CONFIG.ROLES.MEMBER_INTRO && CONFIG.ROLES.MEMBER_INTRO !== 'OFF') {
            try {
                const member = await interaction.guild.members.fetch(interaction.user.id);
                if (member) {
                    await member.roles.add(CONFIG.ROLES.MEMBER_INTRO).catch(err => console.error('Gagal memberi role intro:', err));
                }
            } catch (err) {
                console.error('Gagal mengambil data member untuk memberi role:', err);
            }
        }

        await interaction.reply({ content: `🎉 **Perkenalan kamu berhasil dikirim ke <#${targetChannel.id}> dan role kamu telah diberikan!**`, ephemeral: true });
        await targetChannel.send({ content: `👋 Perkenalan baru dari <@${interaction.user.id}>!`, embeds: [resultEmbed] });
    }

    // 📖 RESPON AKIRA BOT GUIDE DROPDOWN MENU (PANDUAN BOT)
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_guide_menu') {
        const selected = interaction.values[0];

        // 🎮 WORDCHAIN GUIDE
        if (selected === 'guide_wordchain') {
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.INFO)
                .setTitle('🎮 WordChain Guide')
                .setDescription(
                    '📖 **Apa itu WordChain?**\n' +
                    'Word Chain adalah game sambung kata berbahasa Inggris. Kirim kata yang diawali huruf terakhir dari kata valid sebelumnya.\n' +
                    '• *Contoh:* `apple` → `elephant` → `tiger` → `rabbit`\n\n' +
                    '🔄 **Cara Bermain**\n' +
                    '1. Lihat kata terakhir yang valid.\n' +
                    '2. Kirim kata bahasa Inggris yang diawali huruf terakhir kata tersebut.\n' +
                    '3. Tunggu giliran pemain lain.\n' +
                    '• *Selalu sambung dari kata valid terakhir, bukan dari pesan terakhir di chat.*\n\n' +
                    '✅ **Kata Valid & Coin Rewards**\n' +
                    'Kata dianggap valid jika bot kasih reaksi poin:\n' +
                    '4️⃣ → 1–6 huruf\n' +
                    '6️⃣ → 7+ huruf\n' +
                    '8️⃣ → 7+ huruf, huruf pertama & terakhir sama *(contoh: redivider, rotavator)*\n' +
                    '• *Tidak ada reaksi = kata tidak valid, jangan dipakai buat lanjut.*\n\n' +
                    '🚨 **Penalti**\n' +
                    '• Kata tidak valid: **-2 Coins**\n' +
                    '• Melanggar giliran/aturan: **-2 Coins**\n\n' +
                    '📌 **Tips**\n' +
                    '└ Pastikan ejaan bahasa Inggris benar\n' +
                    '└ Kata lebih panjang = coin lebih banyak\n' +
                    '└ Tunggu reaksi bot sebelum lanjut\n' +
                    '└ Kalau kata ditolak, lanjutkan dari kata valid sebelumnya\n\n' +
                    '**Good luck & have fun! 🏆**'
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (selected === 'guide_quiz') {
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.WARNING)
                .setTitle('🧠 Panduan: Infinity Quiz - Non Event')
                .setDescription(
                    '**Cara Bermain Kuis:**\n' +
                    '└ Ketik `tebakkata` di channel bot commands.\n' +
                    '└ Jawab pertanyaan sebelum waktu 30 detik habis!\n' +
                    '└ Jawaban benar akan mendapatkan hadiah **+500 Koin**.'
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (selected === 'guide_music') {
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.PURPLE)
                .setTitle('🎵 Music Bot Guide')
                .setDescription(
                    '**Bot tersedia:** Jockie Music, Flavi, Cloudy, Lofi, Beatsync, Hade\n\n' +
                    '🎧 **Basic Commands**\n' +
                    '`/play <judul/link>` ▶ Memutar lagu / tambah ke antrean\n' +
                    '`/search <judul>` 🔍 Cari lagu berdasarkan judul\n' +
                    '`/queue` 📜 Lihat antrean lagu\n' +
                    '`/nowplaying` 🎶 Lagu yang sedang diputar\n' +
                    '`/skip` ⏭ Lewati lagu saat ini\n' +
                    '`/previous` ⏮ Putar lagu sebelumnya\n' +
                    '`/pause` ⏸ Jeda musik\n' +
                    '`/resume` ▶ Lanjutkan musik\n' +
                    '`/stop` ⏹ Stop & kosongkan antrean\n' +
                    '`/leave` 🚪 Keluarkan bot dari voice channel\n' +
                    '`/loop` 🔁 On/off mode loop\n' +
                    '`/shuffle` 🔀 Acak antrean\n' +
                    '`/remove <nomor>` ❌ Hapus lagu dari antrean\n' +
                    '`/clear` 🗑️ Hapus seluruh antrean\n' +
                    '`/volume <1-100>` 🔊 Atur volume\n\n' +
                    '📌 **Cara Pakai**\n' +
                    'Masuk ke voice channel dulu — silakan tekan: **╰・➕┃make-voice-here**\n' +
                    'Ketik command di room voice chat kamu atau di channel **│・🎵┃req-music**\n\n' +
                    '*Bot musik hanya bisa memutar satu lagu dalam satu waktu. Kalau bot terlihat sedang memutar lagu, berarti dipakai orang lain. ' +
                    'Kalau bot tidak terlihat tapi tetap tidak bisa dipakai, kemungkinan bot masuk ke voice yang disembunyikan member lain.*\n\n' +
                    '🎛️ **Command per Bot/Radio**\n' +
                    '• **Jockie Music (01–04)** → prefix `m!` — *contoh:* `m!play Benson Boone – In The Stars`\n' +
                    '• **Radio 05 (Flavi)** → prefix `-` — *contoh:* `-play James Arthur – Car\'s Outside`\n' +
                    '• **Radio 06 (Flavi)** → prefix `=` — *contoh:* `=play One Direction – Counting Stars`\n' +
                    '• **Radio 07 (Cloudy)** → prefix `!` — *contoh:* `!play One Direction – Drag Me Down`\n' +
                    '• **Radio 08–11** → pakai `/` *(slash command bawaan Discord)* — *contoh:* `/play Rihanna – You Da One`'
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (selected === 'guide_features') {
            const embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.PRIMARY)
                .setTitle('🪙 Panduan Akira Economy (Level, Kerja & Games)')
                .setDescription(
                    'Berikut adalah panduan lengkap fitur khusus member yang bisa kamu gunakan:\n\n' +
                    '⭐ **1. Leveling & Profil Status:**\n' +
                    '└ `level` / `rank` — Cek status level & EXP kamu\n' +
                    '└ `leaderboard` / `top` — Peringkat Top 10 besar server\n' +
                    '└ `balance` / `dompet` — Cek jumlah saldo koin kamu\n\n' +
                    '🎁 **2. Hadiah & Ekonomi:**\n' +
                    '└ `daily` — Klaim 2.500 Koin harian gratis\n\n' +
                    '💼 **3. Sistem Karir & Pekerjaan:**\n' +
                    '└ `kerja pilih <profesi>` — Pilih profesi (petani, ojol, kantor, dokter, programmer, artis)\n' +
                    '└ `kerja` — Ambil gaji (cooldown 1 jam)\n\n' +
                    '🎮 **4. Mini-Games Seru:**\n' +
                    '└ `coinflip <taruhan>` / `cf` — Lempar koin H/T (Interactive Buttons)\n' +
                    '└ `blackjack <taruhan>` / `bj` — Main kartu 21 (Interactive Buttons)\n' +
                    '└ `slot <taruhan>` — Mesin slot beranimasi bertahap\n' +
                    '└ `tebakkata` — Kuis tebak kata berhadiah koin'
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
});

// ==========================================
// 💬 EVENT: MESSAGE CREATE
// ==========================================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // 🌟 EXP TAMBAHAN LEWAT ACTIVE CHAT
    if (!expCooldownSet.has(message.author.id)) {
        let addedExp = Math.floor(Math.random() * 15) + 10;
        await addExpToUser(message.author.id, addedExp, message.guild);

        expCooldownSet.add(message.author.id);
        setTimeout(() => expCooldownSet.delete(message.author.id), CONFIG.ECONOMY.EXP_COOLDOWN_MS);
    }

    let rawContent = message.content.trim();
    if (rawContent.startsWith('!')) {
        rawContent = rawContent.slice(1).trim();
    }

    let lowerContent = rawContent.toLowerCase();

    // 💬 RESPONS CHAT UCAPAN SALAM (KHUSUS OWNER & SEKALI PER SESI WAKTU)
    const greetingTriggers = {
        pagi: ['pagi', 'selamat pagi', 'met pagi'],
        siang: ['siang', 'selamat siang', 'met siang'],
        sore: ['sore', 'selamat sore', 'met sore'],
        malam: ['malam', 'selamat malam', 'met malam', 'good night', 'gn']
    };

    let matchedPeriod = null;
    for (const [period, keywords] of Object.entries(greetingTriggers)) {
        if (keywords.includes(lowerContent)) {
            matchedPeriod = period;
            break;
        }
    }

    if (matchedPeriod) {
        message.delete().catch(() => {});

        if (message.author.id === CONFIG.BOT_INFO.OWNER_ID) {
            let activePeriod = getCurrentPeriodKey();

            if (currentGreetingPeriod !== activePeriod) {
                currentGreetingPeriod = activePeriod;
                let textGreeting = getDynamicGreeting();
                return message.channel.send({ content: textGreeting });
            }
        }
        return;
    }

    const args = rawContent.split(/ +/);
    const command = args.shift()?.toLowerCase();

    if (!command) return;

    // 📢 ANNOUNCEMENT
    if (command === 'announcement' || command === 'ann' || command === 'pengumuman') {
        if (message.author.id !== CONFIG.BOT_INFO.OWNER_ID) return;
        let text = args.join(' ');
        if (!text) return message.reply('❌ Masukkan teks pengumuman!');

        const serverIcon = message.guild.iconURL({ dynamic: true }) || CONFIG.SETTINGS.DEFAULT_ICON;

        message.delete().catch(() => {});
        const annEmbed = new EmbedBuilder()
            .setColor(CONFIG.COLORS.DANGER)
            .setAuthor({ name: `PENGUMUMAN RESMI — ${message.guild.name.toUpperCase()}`, iconURL: serverIcon })
            .setTitle('📢 Pengumuman Penting Server')
            .setDescription(text)
            .setThumbnail(serverIcon)
            .setFooter({ text: `Dikirim oleh Owner: ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();

        return message.channel.send({ content: '@everyone', embeds: [annEmbed] });
    }

    const allowedCommands = [
        'help', 'bantuan', 'level', 'rank', 'leaderboard', 'top', 
        'balance', 'dompet', 'kerja', 'daily', 'tebakkata', 'slot', 
        'blackjack', 'bj', 'coinflip', 'cf', 'tambahuang', 'giveaway', 'tambahexp', 'resetexp',
        'sendidentity', 'intro', 'setwelcome', 'setgoodbye', 'setbanner', 'testwelcome', 'testgoodbye', 'setgreeting', 'testgreeting',
        'sendguide', 'guide', 'panduan', 'botguide'
    ];

    if (!allowedCommands.includes(command)) return;

    // Pembatasan channel General Chat
    if (message.channel.id === CONFIG.CHANNELS.GENERAL_CHAT && !['help', 'bantuan', 'panduan', 'botguide', 'guide'].includes(command)) {
        return message.reply(`⚠️ Perintah bot tidak boleh digunakan di channel **General Chat**! Silakan gunakan channel <#${CONFIG.CHANNELS.BOT_COMMANDS}>.`)
            .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000))
            .catch(() => {});
    }

    if ((command === 'intro' || command === 'sendidentity')) {
        if (message.author.id !== CONFIG.BOT_INFO.OWNER_ID) return;
        if (message.channel.id !== CONFIG.CHANNELS.INTRO_FORM) {
            return message.reply(`⚠️ Perintah ini hanya dapat diketik langsung di channel <#${CONFIG.CHANNELS.INTRO_FORM}>!`)
                .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
        }
    }

    const serverIcon = message.guild.iconURL({ dynamic: true }) || CONFIG.SETTINGS.DEFAULT_ICON;

    // 📖 PERINTAH PANDUAN BOT (BISA DIPAKAI OLEH SEMUA MEMBER ATAU OWNER)
    if (command === 'panduan' || command === 'guide' || command === 'botguide') {
        const guideData = createAkiraGuideComponent(serverIcon);
        return message.reply(guideData);
    }

    // 📌 PERINTAH KIRIM GUIDE PERMANEN DI CHANNEL MANA SAJA (OWNER ONLY)
    if (command === 'sendguide') {
        if (message.author.id !== CONFIG.BOT_INFO.OWNER_ID) return;
        message.delete().catch(() => {});
        const guideData = createAkiraGuideComponent(serverIcon);
        return message.channel.send(guideData);
    }

    if (command === 'setgreeting') {
        if (message.author.id !== CONFIG.BOT_INFO.OWNER_ID) return;
        let timeType = args[0]?.toLowerCase();
        let customGreetingText = args.slice(1).join(' ');

        if (!['pagi', 'siang', 'sore', 'malam'].includes(timeType) || !customGreetingText) {
            return message.reply('❌ Format salah! Gunakan: `setgreeting <pagi/siang/sore/malam> <pesan ucapan>`');
        }

        if (timeType === 'pagi') setBotSetting('GREET_PAGI', customGreetingText);
        if (timeType === 'siang') setBotSetting('GREET_SIANG', customGreetingText);
        if (timeType === 'sore') setBotSetting('GREET_SORE', customGreetingText);
        if (timeType === 'malam') setBotSetting('GREET_MALAM', customGreetingText);

        return message.reply(`✅ **Ucapan waktu [ ${timeType.toUpperCase()} ] diubah menjadi:**\n>${customGreetingText}`);
    }

    if (command === 'testgreeting') {
        if (message.author.id !== CONFIG.BOT_INFO.OWNER_ID) return;

        const testEmbed = new EmbedBuilder()
            .setColor(CONFIG.COLORS.INFO)
            .setTitle('🧪 TES SAMBUTAN WAKTU (GREETINGS)')
            .addFields(
                { name: '☀️ Pagi (04:00 - 11:00)', value: `> ${CONFIG.SETTINGS.GREET_PAGI}` },
                { name: '🌤️ Siang (11:00 - 15:00)', value: `> ${CONFIG.SETTINGS.GREET_SIANG}` },
                { name: '🌅 Sore (15:00 - 18:00)', value: `> ${CONFIG.SETTINGS.GREET_SORE}` },
                { name: '🌙 Malam (18:00 - 04:00)', value: `> ${CONFIG.SETTINGS.GREET_MALAM}` }
            )
            .setFooter({ text: `${message.guild.name} • Dynamic Greeting Test`, iconURL: serverIcon })
            .setTimestamp();

        return message.reply({ embeds: [testEmbed] });
    }

    if (command === 'setwelcome') {
        if (message.author.id !== CONFIG.BOT_INFO.OWNER_ID) return;
        let text = args.join(' ');
        if (!text) return message.reply('❌ Masukkan teks welcome!');
        setBotSetting('WELCOME_TEXT', text);
        return message.reply('✅ **Teks pesan Welcome berhasil diperbarui!**');
    }

    if (command === 'setgoodbye') {
        if (message.author.id !== CONFIG.BOT_INFO.OWNER_ID) return;
        let text = args.join(' ');
        if (!text) return message.reply('❌ Masukkan teks goodbye!');
        setBotSetting('GOODBYE_TEXT', text);
        return message.reply('✅ **Teks pesan Goodbye berhasil diperbarui!**');
    }

    if (command === 'setbanner') {
        if (message.author.id !== CONFIG.BOT_INFO.OWNER_ID) return;
        let targetType = args[0]?.toLowerCase();
        let imageUrl = args[1] || message.attachments.first()?.url;

        if (!['welcome', 'goodbye'].includes(targetType) || !imageUrl) {
            return message.reply('❌ Format salah! Gunakan: `setbanner welcome <URL>` atau `setbanner goodbye <URL>`');
        }

        if (targetType === 'welcome') {
            setBotSetting('WELCOME_BANNER', imageUrl);
            return message.reply('✅ **Banner Welcome berhasil diperbarui!**');
        } else {
            setBotSetting('GOODBYE_BANNER', imageUrl);
            return message.reply('✅ **Banner Goodbye berhasil diperbarui!**');
        }
    }

    if (command === 'testwelcome') {
        if (message.author.id !== CONFIG.BOT_INFO.OWNER_ID) return;
        client.emit('guildMemberAdd', message.member);
        return message.reply('🧪 **Mengirimkan tes pesan Welcome...**');
    }

    if (command === 'testgoodbye') {
        if (message.author.id !== CONFIG.BOT_INFO.OWNER_ID) return;
        client.emit('guildMemberRemove', message.member);
        return message.reply('🧪 **Mengirimkan tes pesan Goodbye...**');
    }

    if (command === 'sendidentity' || command === 'intro') {
        message.delete().catch(() => {});

        const identityEmbed = new EmbedBuilder()
            .setColor('#2C2F33')
            .setTitle('Kasih tau siapa kamu')
            .setDescription('Perkenalkan dirimu dengan mengisi form ini ya')
            .addFields(
                { name: 'Nama panggilan', value: 'Kamu mau dipanggil apa?', inline: true },
                { name: 'Umur?', value: 'Jangan malu malu!!', inline: true },
                { name: 'Asal Kota?', value: 'Gaakan kita grebek kok', inline: true },
                { name: 'Game yang kamu sukai?', value: 'Ayo mabar', inline: false }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_identity_modal')
                .setLabel('Ayo kenalan!!')
                .setStyle(ButtonStyle.Primary)
        );

        return message.channel.send({ embeds: [identityEmbed], components: [row] });
    }

    // 📖 HELP COMMAND
    if (command === 'help' || command === 'bantuan') {
        // Jika dipanggil oleh Owner/Admin: Kirim Panel Admin ringkas & rapi
        if (message.author.id === CONFIG.BOT_INFO.OWNER_ID) {
            const adminEmbed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.DANGER)
                .setAuthor({ name: `PANEL ADMINISTRATOR — ${message.guild.name.toUpperCase()}`, iconURL: serverIcon })
                .setTitle(`👑 Kontrol Rahasia Administrator Bot`)
                .setDescription(`Halo **Owner ${message.author.username}**!\n🔒 *Perintah di bawah ini disembunyikan dari member.*`)
                .addFields(
                    {
                        name: '🛠️ Perintah Kontrol Admin',
                        value: '`sendguide` — Kirim embed panduan bot permanen\n' +
                               '`panduan` / `guide` — Tampilkan menu panduan interaktif\n' +
                               '`intro` / `sendidentity` — Kirim form perkenalan di #intro-form\n' +
                               '`setgreeting <pagi/siang/sore/malam> <pesan>` — Atur ucapan waktu\n' +
                               '`testgreeting` — Tes pesan ucapan waktu\n' +
                               '`setwelcome <teks>` — Atur pesan Welcome kustom\n' +
                               '`setgoodbye <teks>` — Atur pesan Goodbye kustom\n' +
                               '`setbanner welcome/goodbye <link>` — Ubah banner\n' +
                               '`testwelcome` / `testgoodbye` — Tes embed welcome/goodbye\n' +
                               '`announcement <teks>` — Pengumuman (+ @everyone)\n' +
                               '`tambahuang @user <jumlah>` — Tambah koin member\n' +
                               '`tambahexp @user <jumlah>` — Tambah EXP member\n' +
                               '`resetexp @user / all` — Reset level member\n' +
                               '`giveaway <hadiah> <menit>` — Buka event giveaway'
                    },
                    {
                        name: '👥 Perintah Member',
                        value: '`level` / `rank` — Cek level & EXP\n' +
                               '`leaderboard` / `top` — Peringkat Top 10 server\n' +
                               '`balance` / `dompet` — Cek saldo koin\n' +
                               '`daily` — Klaim koin harian gratis\n' +
                               '`kerja` / `kerja pilih <profesi>` — Sistem karir & ambil gaji\n' +
                               '`coinflip <taruhan>` / `cf` — Game lempar koin\n' +
                               '`blackjack <taruhan>` / `bj` — Game kartu 21\n' +
                               '`slot <taruhan>` — Game mesin slot animasi\n' +
                               '`tebakkata` — Game kuis tebak kata'
                    }
                )
                .setFooter({ text: `${message.guild.name} • Strictly Confidential Panel`, iconURL: serverIcon })
                .setTimestamp();

            return message.reply({ embeds: [adminEmbed] });
        }

        // Jika dipanggil oleh Member biasa: Kirim Panduan Bot
        const guideData = createAkiraGuideComponent(serverIcon);
        return message.reply(guideData);
    }

    // 📊 LEVEL / RANK
    if (command === 'level' || command === 'rank') {
        let user = await DatabaseService.getUser(message.author.id);
        let nextExp = user.level * 100;
        const embed = new EmbedBuilder()
            .setColor(CONFIG.COLORS.PURPLE)
            .setAuthor({ name: `PROFILE STATUS — ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
            .setTitle('📊 Level & EXP Member')
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '⭐ Level Profil', value: `\`Level ${user.level}\``, inline: true },
                { name: '✨ Progres EXP', value: `\`${user.exp} / ${nextExp} EXP\``, inline: true },
                { name: '💰 Saldo Koin', value: `\`${user.balance.toLocaleString()} Koin\``, inline: true }
            )
            .setFooter({ text: `${message.guild.name} • Level Directory`, iconURL: serverIcon })
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }

    // 🏆 LEADERBOARD
    if (command === 'leaderboard' || command === 'top') {
        let rows = await DatabaseService.getLeaderboard(10);
        if (rows.length === 0) return message.reply('❌ Belum ada data peringkat.');

        let lbText = "";
        let medals = ['🥇', '🥈', '🥉'];
        if (rows[0]) synchronizeTopRole(message.guild, rows[0].userId);

        for (let i = 0; i < rows.length; i++) {
            let medal = medals[i] || `\`#${i + 1}\``;
            let topTag = (i === 0) ? ' 👑 *(Top 1 Server)*' : '';
            lbText += `${medal} <@${rows[i].userId}> — **Level ${rows[i].level}** (\`${rows[i].exp} EXP\`)${topTag}\n`;
        }

        const lbEmbed = new EmbedBuilder()
            .setColor(CONFIG.COLORS.GOLD)
            .setAuthor({ name: `OFFICIAL LEADERBOARD — ${message.guild.name.toUpperCase()}`, iconURL: serverIcon })
            .setTitle('🏆 Peringkat Level Member Server')
            .setDescription(lbText)
            .setThumbnail(serverIcon)
            .setFooter({ text: `${message.guild.name} • Terus aktif chat!`, iconURL: serverIcon })
            .setTimestamp();
        return message.reply({ embeds: [lbEmbed] });
    }

    // 🪙 BALANCE / DOMPET
    if (command === 'balance' || command === 'dompet') {
        let user = await DatabaseService.getUser(message.author.id);
        const embed = new EmbedBuilder()
            .setColor(CONFIG.COLORS.SUCCESS)
            .setAuthor({ name: `WALLET STATUS — ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
            .setTitle('🪙 Dompet Koin Member')
            .addFields(
                { name: '💰 Total Saldo', value: `**${user.balance.toLocaleString()} Koin**`, inline: true },
                { name: '💼 Pekerjaan', value: `\`${user.job.toUpperCase()}\``, inline: true },
                { name: '⭐ Level', value: `\`Level ${user.level}\``, inline: true }
            )
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }

    // 💼 KERJA
    if (command === 'kerja' && args[0] === 'pilih') {
        let jobKey = args[1]?.toLowerCase();
        if (!JOBS[jobKey]) return message.reply(`❌ Profesi tidak valid! Pilih: \`${Object.keys(JOBS).join(', ')}\``);
        await DatabaseService.setJob(message.author.id, jobKey);
        return message.reply(`✅ Kamu sekarang bekerja sebagai **${JOBS[jobKey].name.toUpperCase()}**! Ketik \`kerja\` untuk ambil gaji.`);
    }

    if (command === 'kerja') {
        let user = await DatabaseService.getUser(message.author.id);
        if (user.job === 'pengangguran' || !JOBS[user.job]) return message.reply('❌ Pilih pekerjaan dulu! Contoh: `kerja pilih kantor`');

        let now = Date.now();
        if (user.lastWork && now < parseInt(user.lastWork) + CONFIG.ECONOMY.WORK_COOLDOWN_MS) {
            let minLeft = Math.ceil((parseInt(user.lastWork) + CONFIG.ECONOMY.WORK_COOLDOWN_MS - now) / 60000);
            return message.reply(`⏳ Kamu masih lelah! Bekerja lagi dalam **${minLeft} menit**.`);
        }

        let salary = JOBS[user.job].gaji;
        await DatabaseService.updateBalance(message.author.id, salary);
        await DatabaseService.setLastWork(message.author.id, now.toString());
        let updated = await DatabaseService.getUser(message.author.id);
        return message.reply(`💼 Sukses bekerja sebagai **${JOBS[user.job].name.toUpperCase()}**! Dapat **+${salary.toLocaleString()} Koin** (Total: **${updated.balance.toLocaleString()} Koin**).`);
    }

    // 🎁 DAILY
    if (command === 'daily') {
        let user = await DatabaseService.getUser(message.author.id);
        let now = Date.now();
        if (user.lastDaily && now < parseInt(user.lastDaily) + 86400000) {
            let hrLeft = Math.ceil((parseInt(user.lastDaily) + 86400000 - now) / 3600000);
            return message.reply(`⏳ Tunggu **${hrLeft} jam** lagi untuk mengambil daily berikutnya.`);
        }

        await DatabaseService.updateBalance(message.author.id, CONFIG.ECONOMY.DAILY_REWARD);
        await DatabaseService.setLastDaily(message.author.id, now.toString());
        let updated = await DatabaseService.getUser(message.author.id);
        return message.reply(`🎁 Daily claim berhasil! Kamu dapat **2.500 Koin** (Total Saldo: **${updated.balance.toLocaleString()} Koin**).`);
    }

    // 💵 TAMBAH UANG
    if (command === 'tambahuang') {
        if (message.author.id !== CONFIG.BOT_INFO.OWNER_ID) return;
        let target = message.mentions.users.first() || message.author;
        let amount = parseInt(args[message.mentions.users.size ? 1 : 0]);
        if (isNaN(amount)) return message.reply('❌ Masukkan angka valid!');

        await DatabaseService.updateBalance(target.id, amount);
        let updated = await DatabaseService.getUser(target.id);
        return message.reply(`✅ Berhasil menambahkan **${amount.toLocaleString()} Koin** ke **${target.username}** (Total: **${updated.balance.toLocaleString()} Koin**).`);
    }

    // ✨ TAMBAH EXP
    if (command === 'tambahexp') {
        if (message.author.id !== CONFIG.BOT_INFO.OWNER_ID) return;
        let target = message.mentions.users.first();
        let expAmount = parseInt(args[1]);
        if (!target || isNaN(expAmount) || expAmount <= 0) return message.reply('❌ Format: `tambahexp @user 150`');

        await addExpToUser(target.id, expAmount, message.guild);
        return message.reply(`✅ Berhasil tambah **${expAmount} EXP** ke **${target.username}**.`);
    }

    // ⚠️ RESET EXP
    if (command === 'resetexp') {
        if (message.author.id !== CONFIG.BOT_INFO.OWNER_ID) return;
        if (args[0] === 'all') {
            await DatabaseService.resetAllExp();
            return message.reply('⚠️ Seluruh Level & EXP member direset ke Level 1.');
        }
        let target = message.mentions.users.first();
        if (!target) return message.reply('❌ Format: `resetexp @user` atau `resetexp all`');

        await DatabaseService.resetUserExp(target.id);
        return message.reply(`✅ Level & EXP **${target.username}** direset ke Level 1.`);
    }

    // 🎉 GIVEAWAY
    if (command === 'giveaway') {
        if (message.author.id !== CONFIG.BOT_INFO.OWNER_ID) return;
        let durationMin = parseInt(args[args.length - 1]);
        let prizeName = args.slice(0, -1).join(' ');

        if (!prizeName || isNaN(durationMin) || durationMin <= 0) {
            return message.reply('❌ Format: `giveaway <Hadiah> <DurasiMenit>`');
        }

        const gwEmbed = new EmbedBuilder()
            .setColor(CONFIG.COLORS.PURPLE)
            .setAuthor({ name: `GIVEAWAY SPESIAL — ${message.guild.name.toUpperCase()}`, iconURL: serverIcon })
            .setTitle('🎉 Event Giveaway Server')
            .setDescription(`🎁 **Hadiah:** **${prizeName}**\n⏳ **Durasi:** ${durationMin} Menit\n\n*Klik reaksi emoji 🎉 di bawah untuk ikut!*`)
            .setThumbnail(serverIcon)
            .setTimestamp();

        let gwMsg = await message.channel.send({ content: '@everyone', embeds: [gwEmbed] });
        if (gwMsg) await gwMsg.react('🎉');

        const filter = (reaction, user) => reaction.emoji.name === '🎉' && !user.bot;
        const collector = gwMsg.createReactionCollector({ filter, time: durationMin * 60 * 1000 });

        collector.on('end', async () => {
            let reaction = gwMsg.reactions.cache.get('🎉');
            if (!reaction) return message.channel.send('❌ Giveaway dibatalkan.');

            let users = await reaction.users.fetch();
            let realUsers = users.filter(u => !u.bot);
            if (realUsers.size === 0) return message.channel.send('😢 Giveaway berakhir tanpa peserta.');

            let winner = realUsers.random();
            message.channel.send({ content: `🎉 Selamat <@${winner.id}>, kamu memenangkan **${prizeName}**!` });
        });
        return;
    }

    // 🪙 COIN FLIP
    if (command === 'coinflip' || command === 'cf') {
        let bet = parseInt(args[0]);
        let user = await DatabaseService.getUser(message.author.id);

        if (isNaN(bet) || bet <= 0) return message.reply('❌ Masukkan jumlah taruhan koin! Contoh: `cf 500`');
        if (user.balance < bet) return message.reply(`❌ Saldo kurang! Sisa saldo kamu: **${user.balance.toLocaleString()} Koin**.`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cf_heads').setLabel('🔵 Heads (H)').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('cf_tails').setLabel('🟢 Tails (T)').setStyle(ButtonStyle.Success)
        );

        const embed = new EmbedBuilder()
            .setColor(CONFIG.COLORS.INFO)
            .setTitle('🪙 PERMAINAN LEMPAR KOIN')
            .setDescription(`Pilih **Heads (Gambar)** atau **Tails (Angka)** dengan memencet tombol di bawah ini!\n\n💰 **Taruhan:** \`${bet.toLocaleString()} Koin\``)
            .setFooter({ text: 'Waktu memilih 20 detik', iconURL: serverIcon });

        const cfMsg = await message.reply({ embeds: [embed], components: [row] });

        const filter = (i) => i.user.id === message.author.id;
        const collector = cfMsg.createMessageComponentCollector({ filter, time: 20000 });

        collector.on('collect', async (i) => {
            collector.stop('chosen');

            await DatabaseService.updateBalance(message.author.id, -bet);

            const userChoice = i.customId === 'cf_heads' ? 'HEADS' : 'TAILS';
            const outcome = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
            const isWin = userChoice === outcome;

            if (isWin) {
                await DatabaseService.updateBalance(message.author.id, bet * 2);
            }

            let updated = await DatabaseService.getUser(message.author.id);

            const resultEmbed = new EmbedBuilder()
                .setColor(isWin ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.DANGER)
                .setTitle(`🪙 KOIN BERPUTAR... HASIL: [ ${outcome} ]`)
                .setDescription(
                    `👤 **Pilihan Kamu:** \`${userChoice}\`\n` +
                    `🪙 **Hasil Koin:** \`${outcome}\`\n\n` +
                    (isWin ? `🎉 **MENANG!** Kamu mendapatkan **+${(bet * 2).toLocaleString()} Koin**!` : `😢 **KALAH!** Kamu kehilangan **-${bet.toLocaleString()} Koin**.`) +
                    `\n💰 Saldo Sekarang: **${updated.balance.toLocaleString()} Koin**`
                )
                .setTimestamp();

            return i.update({ embeds: [resultEmbed], components: [] });
        });

        collector.on('end', (_, reason) => {
            if (reason === 'time') {
                cfMsg.edit({ content: '⏰ Waktu memilih habis! Taruhan dibatalkan.', components: [] }).catch(() => {});
            }
        });
    }

    // 🎮 TEBAK KATA
    if (command === 'tebakkata') {
        if (activeGameSessions.has(message.channel.id)) return message.reply('⚠️ Masih ada game aktif di channel ini!');

        let quiz = TEBAK_KATA_QUESTIONS[Math.floor(Math.random() * TEBAK_KATA_QUESTIONS.length)];
        activeGameSessions.set(message.channel.id, quiz.jawaban);

        let embed = new EmbedBuilder()
            .setColor(CONFIG.COLORS.WARNING)
            .setTitle('🎮 Mini-Game: Tebak Kata')
            .setDescription(`Pertanyaan:\n**"${quiz.soal}"**\n\n⏱️ *Waktu: 30 detik.*`);

        await message.reply({ embeds: [embed] });

        const filter = (m) => !m.author.bot;
        const collector = message.channel.createMessageCollector({ filter, time: 30000 });

        collector.on('collect', async (m) => {
            if (m.content.toLowerCase() === quiz.jawaban) {
                collector.stop('correct');
                activeGameSessions.delete(message.channel.id);
                await DatabaseService.updateBalance(m.author.id, 500);
                return m.reply(`🎉 **Benar!** Jawabannya adalah **${quiz.jawaban}** (+500 Koin).`);
            }
        });

        collector.on('end', (_, reason) => {
            if (reason !== 'correct' && activeGameSessions.has(message.channel.id)) {
                activeGameSessions.delete(message.channel.id);
                message.channel.send(`⏰ Waktu habis! Jawabannya: **${quiz.jawaban}**.`);
            }
        });
    }

    // ==========================================
    // 🎰 SLOT ANIMATED
    // ==========================================
    if (command === 'slot') {
        let bet = parseInt(args[0]);
        let user = await DatabaseService.getUser(message.author.id);

        if (isNaN(bet) || bet <= 0) return message.reply('❌ Masukkan taruhan! Contoh: `slot 500`');
        if (user.balance < bet) return message.reply(`❌ Saldo kurang! Sisa: **${user.balance.toLocaleString()} Koin**.`);

        // Potong taruhan di awal
        await DatabaseService.updateBalance(message.author.id, -bet);

        const symbols = ['🍇', '🍊', '🍋', '🍒', '💎', '7️⃣'];

        // Acak hasil akhir
        const final1 = symbols[Math.floor(Math.random() * symbols.length)];
        const final2 = symbols[Math.floor(Math.random() * symbols.length)];
        const final3 = symbols[Math.floor(Math.random() * symbols.length)];

        // Frame 1: Memutar semua
        const frame1Embed = new EmbedBuilder()
            .setColor(CONFIG.COLORS.WARNING)
            .setTitle('🎰 MESIN SLOT BERPUTAR...')
            .setDescription(`[ 🎰 | 🎰 | 🎰 ]\n\n💰 Taruhan: \`${bet.toLocaleString()} Koin\``)
            .setFooter({ text: 'Memutar roda...', iconURL: serverIcon });

        let slotMsg = await message.reply({ embeds: [frame1Embed] });

        // Frame 2: Roda 1 Berhenti (800ms)
        setTimeout(async () => {
            const frame2Embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.WARNING)
                .setTitle('🎰 MESIN SLOT BERPUTAR...')
                .setDescription(`[ ${final1} | 🎰 | 🎰 ]\n\n💰 Taruhan: \`${bet.toLocaleString()} Koin\``)
                .setFooter({ text: 'Memutar roda 2 & 3...', iconURL: serverIcon });

            if (slotMsg) await slotMsg.edit({ embeds: [frame2Embed] }).catch(() => {});
        }, 800);

        // Frame 3: Roda 2 Berhenti (1600ms)
        setTimeout(async () => {
            const frame3Embed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.WARNING)
                .setTitle('🎰 MESIN SLOT BERPUTAR...')
                .setDescription(`[ ${final1} \vert{}${final2} | 🎰 ]\n\n💰 Taruhan: \`${bet.toLocaleString()} Koin\``)
                .setFooter({ text: 'Memutar roda 3...', iconURL: serverIcon });

            if (slotMsg) await slotMsg.edit({ embeds: [frame3Embed] }).catch(() => {});
        }, 1600);

        // Frame 4 (Hasil Akhir): Roda 3 Berhenti & Hitung Hadiah (2400ms)
        setTimeout(async () => {
            let multiplier = 0;
            let isJackpotInf = false;

            if (final1 === final2 && final2 === final3) {
                if (final1 === '🍇') multiplier = 1;
                else if (final1 === '🍊') multiplier = 2;
                else if (final1 === '🍋') multiplier = 3;
                else if (final1 === '🍒') multiplier = 4;
                else if (final1 === '💎') multiplier = 4;
                else if (final1 === '7️⃣') {
                    multiplier = 10;
                    isJackpotInf = true;
                }
            }

            let winAmount = bet * multiplier;
            if (winAmount > 0) {
                await DatabaseService.updateBalance(message.author.id, winAmount);
            }

            let updated = await DatabaseService.getUser(message.author.id);

            let resultText = "";
            if (winAmount > 0) {
                if (isJackpotInf) {
                    resultText = `💥 **JACKPOT 🇮 🇳 🇫!** Kamu mendapatkan **+${winAmount.toLocaleString()} Koin**! 🎉`;
                } else {
                    resultText = `🎉 **MENANG (${multiplier}x)!** Kamu mendapatkan **+${winAmount.toLocaleString()} Koin**!`;
                }
            } else {
                resultText = `😢 **KALAH!** Kamu kehilangan **-${bet.toLocaleString()} Koin**.`;
            }

            const resultEmbed = new EmbedBuilder()
                .setColor(winAmount > 0 ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.DANGER)
                .setTitle('🎰 HASIL MESIN SLOT')
                .setDescription(
                    `[ ${final1} | ${final2} | ${final3} ]\n\n` +
                    `${resultText}\n` +
                    `💰 Saldo Sekarang: **${updated.balance.toLocaleString()} Koin**`
                )
                .setTimestamp();

            if (slotMsg) await slotMsg.edit({ embeds: [resultEmbed] }).catch(() => {});
        }, 2400);
    }

    // 🃏 BLACKJACK
    if (command === 'blackjack' || command === 'bj') {
        let bet = parseInt(args[0]);
        let user = await DatabaseService.getUser(message.author.id);

        if (isNaN(bet) || bet <= 0) return message.reply('❌ Masukkan taruhan! Contoh: `bj 500`');
        if (user.balance < bet) return message.reply(`❌ Saldo kurang! Sisa: **${user.balance.toLocaleString()} Koin**.`);

        await DatabaseService.updateBalance(message.author.id, -bet);

        let playerCards = [Math.floor(Math.random() * 10) + 1, Math.floor(Math.random() * 10) + 1];
        let dealerCards = [Math.floor(Math.random() * 10) + 1, Math.floor(Math.random() * 10) + 1];

        const getSum = (arr) => arr.reduce((a, b) => a + b, 0);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bj_hit').setLabel('🎯 Hit (Tambah Kartu)').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('bj_stand').setLabel('🛑 Stand (Tahan Kartu)').setStyle(ButtonStyle.Success)
        );

        const embed = new EmbedBuilder()
            .setColor(CONFIG.COLORS.INFO)
            .setTitle('🃏 MEJA BLACKJACK (Klik Tombol di Bawah)')
            .setDescription(`👤 **Kartu Kamu:** [ ${playerCards.join(' | ')} ] (Total: **${getSum(playerCards)}**)\n🏦 **Dealer:** [ ${dealerCards[0]} | ❓ ]\n\n💰 *Taruhan:* **${bet.toLocaleString()} Koin**`);

        const bjMsg = await message.reply({ embeds: [embed], components: [row] });

        const filter = (i) => i.user.id === message.author.id;
        const collector = bjMsg.createMessageComponentCollector({ filter, time: 30000 });

        collector.on('collect', async (i) => {
            if (i.customId === 'bj_hit') {
                playerCards.push(Math.floor(Math.random() * 10) + 1);
                let pTotal = getSum(playerCards);

                if (pTotal > 21) {
                    collector.stop('bust');
                    let updated = await DatabaseService.getUser(message.author.id);
                    const bustEmbed = new EmbedBuilder()
                        .setColor(CONFIG.COLORS.DANGER)
                        .setTitle('💥 BUST! (Total Kartu Melebihi 21)')
                        .setDescription(`👤 **Kartu Kamu:** [ ${playerCards.join(' | ')} ] (Total: **${pTotal}**)\n\n😢 Kamu kalah **${bet.toLocaleString()} Koin**.\n💰 Saldo Sekarang: **${updated.balance.toLocaleString()} Koin**`);
                    return i.update({ embeds: [bustEmbed], components: [] });
                } else {
                    const hitEmbed = new EmbedBuilder()
                        .setColor(CONFIG.COLORS.INFO)
                        .setTitle('🃏 MEJA BLACKJACK')
                        .setDescription(`👤 **Kartu Kamu:** [ ${playerCards.join(' | ')} ] (Total: **${pTotal}**)\n🏦 **Dealer:** [ ${dealerCards[0]} | ❓ ]`);
                    return i.update({ embeds: [hitEmbed], components: [row] });
                }
            }

            if (i.customId === 'bj_stand') {
                collector.stop('stand');
                let pTotal = getSum(playerCards);
                let dTotal = getSum(dealerCards);

                while (dTotal < 17) {
                    dealerCards.push(Math.floor(Math.random() * 10) + 1);
                    dTotal = getSum(dealerCards);
                }

                let resultMsg = "";
                let winAmount = 0;

                if (dTotal > 21 || pTotal > dTotal) {
                    winAmount = bet * 2;
                    await DatabaseService.updateBalance(message.author.id, winAmount);
                    resultMsg = `🎉 **MENANG! Dapat +${winAmount.toLocaleString()} Koin!**`;
                } else if (pTotal < dTotal) {
                    resultMsg = `😢 **KALAH!** Dealer menang.`;
                } else {
                    winAmount = bet;
                    await DatabaseService.updateBalance(message.author.id, winAmount);
                    resultMsg = `🤝 **SERI (Push)!** Taruhan dikembalikan.`;
                }

                let updated = await DatabaseService.getUser(message.author.id);
                const finalEmbed = new EmbedBuilder()
                    .setColor(winAmount > 0 ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.DANGER)
                    .setTitle('🃏 HASIL AKHIR BLACKJACK')
                    .setDescription(`👤 **Kamu:** [ ${playerCards.join(' | ')} ] (Total: ${pTotal})\n🏦 **Dealer:** [ ${dealerCards.join(' | ')} ] (Total: ${dTotal})\n\n${resultMsg}\n💰 Saldo Sekarang: **${updated.balance.toLocaleString()} Koin**`);

                return i.update({ embeds: [finalEmbed], components: [] });
            }
        });

        collector.on('end', (_, reason) => {
            if (reason === 'time') {
                bjMsg.edit({ content: '⏰ Waktu memilih habis!', components: [] }).catch(() => {});
            }
        });
    }
});

client.login(process.env.TOKEN);
