import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} from 'discord.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID, GEMINI_API_KEY } = process.env;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const FOOTER = process.env.PANEL_FOOTER || 'CS System';
const COOLDOWN_MS = Number(process.env.COOLDOWN_MS || 30000);

if (!DISCORD_TOKEN || !CLIENT_ID || !GEMINI_API_KEY) {
  console.error('Variabel wajib belum lengkap: DISCORD_TOKEN, CLIENT_ID, GEMINI_API_KEY');
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Pilihan panel                                                       */
/* ------------------------------------------------------------------ */

const LATAR = [
  ['Keluarga Miskin', 'Hidup pas-pasan, sejak kecil terbiasa berhemat'],
  ['Keluarga Menengah', 'Hidup cukup, keluarga biasa saja'],
  ['Keluarga Kaya', 'Hidup berkecukupan, orang tua punya usaha besar'],
  ['Yatim Piatu', 'Tumbuh tanpa orang tua'],
  ['Broken Home', 'Orang tua berpisah, rumah tidak harmonis'],
  ['Anak Rantau', 'Merantau dari daerah asal sejak muda'],
  ['Anak Jalanan', 'Besar di jalan, belajar bertahan sendiri'],
  ['Keluarga Pedagang', 'Tumbuh di lingkungan warung dan pasar'],
  ['Keluarga Petani/Nelayan', 'Tumbuh di desa, hidup dekat alam'],
  ['Keluarga Militer/Polisi', 'Disiplin keras sejak kecil'],
  ['Keluarga Kriminal', 'Lingkungan keluarga dekat dunia gelap'],
];

const VIBE = [
  ['Tenang & Misterius', 'Jarang bicara, sulit ditebak'],
  ['Ceria & Humoris', 'Gampang akrab, suka bercanda'],
  ['Keras & Tegas', 'Tidak suka basa-basi'],
  ['Licik & Perhitungan', 'Selalu punya rencana'],
  ['Pendiam & Tertutup', 'Menyimpan semuanya sendiri'],
  ['Pemberani & Nekat', 'Bertindak dulu, mikir belakangan'],
  ['Ramah & Setia Kawan', 'Loyal pada teman dan keluarga'],
  ['Dingin & Ambisius', 'Fokus pada tujuan, sedikit peduli sekitar'],
  ['Santai & Cuek', 'Hidup mengalir apa adanya'],
];

const BAHASA = [
  ['Indonesia', 'Cerita dalam bahasa Indonesia'],
  ['English', 'Story in English'],
];

const PARAGRAF = ['3', '4', '5'];

/* ------------------------------------------------------------------ */
/* Prompt                                                              */
/* ------------------------------------------------------------------ */

function buildStyleRules(lang, paragraphs) {
  const langLine =
    lang === 'English'
      ? 'Write the story in natural, casual-but-competent English, the way a regular player would write it.'
      : 'Tulis dalam bahasa Indonesia yang natural, seperti pemain biasa menulis, bukan bahasa buku pelajaran.';

  return `
Kamu menulis character story untuk karakter roleplay. ${langLine}
Tulisan harus terbaca seperti buatan manusia, bukan AI.

Aturan gaya (wajib):
- Panjang kalimat tidak boleh seragam. Campur kalimat sangat pendek (3-6 kata) dengan kalimat panjang yang agak berliku. Sesekali biarkan ada kalimat yang menggantung atau kurang rapi.
- Pakai detail spesifik dan membumi yang cocok dengan latar karakter: tempat, makanan, kebiasaan, benda sehari-hari, nama panggilan. Hindari yang generik.
- Hindari frasa dan kata sambung klise AI. Indonesia: "selain itu", "oleh karena itu", "dengan demikian", "pada akhirnya", "seiring berjalannya waktu", "perjalanan hidup", "tidak hanya... tetapi juga". English: "delve", "tapestry", "testament to", "little did he know", "shaped who he is today", "moreover", "in a world where".
- Jangan bikin pola tiga hal paralel yang rapi. Jangan simetris. Jangan ada kalimat penutup yang menyimpulkan atau menggurui.
- Jangan terlalu menjelaskan perasaan. Tunjukkan lewat kejadian kecil dan tindakan.
- Jangan pakai tanda pisah panjang (— atau –), tanda bintang, tanda pagar, bullet, judul, atau penomoran. Hanya paragraf biasa.
- Panjang tiap paragraf boleh berbeda, ada yang 2 kalimat, ada yang 6 kalimat.
- Akhiri dengan situasi karakter saat ini, bukan moral atau ringkasan.

Isi:
- Data dari pemain adalah fakta dan tidak boleh bertentangan. Kembangkan dengan detail yang konsisten.
- Timeline harus masuk akal terhadap umur karakter (sekolah, pekerjaan, kejadian penting).
- Sudut pandang orang ketiga, memakai nama karakter.
- Tulis TEPAT ${paragraphs} paragraf, masing-masing sekitar 90 sampai 150 kata.
- Keluarkan hanya teks ceritanya, tanpa pembuka atau komentar.
`.trim();
}

function buildRewriteRules(lang, paragraphs) {
  return `
Tulis ulang character story di bawah supaya terbaca seperti ditulis manusia biasa. Bahasa tetap ${lang}.
Pertahankan semua fakta, nama, tempat, dan urutan kejadian, dan tetap ${paragraphs} paragraf. Ubah ritme dan pilihan kata:
- variasikan panjang kalimat dengan tajam (ada yang sangat pendek, ada yang panjang),
- buang frasa klise dan kata sambung formal,
- pecah pola paralel yang terlalu rapi,
- kurangi penjelasan emosi yang eksplisit,
- jangan pakai tanda pisah panjang, bullet, judul, atau tanda bintang,
- jangan menambah kesimpulan atau moral di akhir.
Keluarkan hanya teks hasil tulis ulang.
`.trim();
}

/* ------------------------------------------------------------------ */
/* Gemini                                                              */
/* ------------------------------------------------------------------ */

async function callGemini({ system, user, temperature = 1 }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature, maxOutputTokens: 8192 },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || '').join('').trim();
  if (!text) {
    throw new Error(`Gemini kosong: ${JSON.stringify(data.promptFeedback || data.candidates?.[0]?.finishReason || 'unknown')}`);
  }
  return text;
  }

/* ------------------------------------------------------------------ */
/* Helper                                                              */
/* ------------------------------------------------------------------ */

function cleanText(text) {
  return text
    .replace(/[—–]/g, ', ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\*\*?/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/^[\-•]\s+/gm, '')
    .replace(/ ,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitText(text, limit = 1900) {
  const paragraphs = text.split(/\n{2,}/);
  const chunks = [];
  let current = '';
  for (const p of paragraphs) {
    if (p.length > limit) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      for (let i = 0; i < p.length; i += limit) chunks.push(p.slice(i, i + limit));
      continue;
    }
    if ((current + '\n\n' + p).length > limit && current) {
      chunks.push(current);
      current = p;
    } else {
      current = current ? current + '\n\n' + p : p;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function normalizeGender(g) {
  const v = g.trim().toLowerCase();
  if (['male', 'm', 'pria', 'laki-laki', 'laki laki', 'cowok'].includes(v)) return 'pria (male)';
  if (['female', 'f', 'wanita', 'perempuan', 'cewek'].includes(v)) return 'wanita (female)';
  return g.trim();
}

async function generateStory(data) {
  const year = new Date().getFullYear();
  const ageNum = parseInt(data.age, 10);
  const info = [
    `Nama karakter: ${data.name}`,
    `Umur: \( {data.age} \){Number.isFinite(ageNum) ? ` (kira-kira lahir tahun ${year - ageNum})` : ''}`,
    `Jenis kelamin: ${normalizeGender(data.gender)}`,
    `Latar belakang kehidupan: ${data.latar}`,
    `Vibe kepribadian: ${data.vibe}`,
    data.personality ? `Deskripsi kepribadian dari pemain:\n${data.personality}` : '',
    data.extra ? `Detail tambahan dari pemain:\n${data.extra}` : '',
    `Tahun sekarang: ${year}`,
  ]
    .filter(Boolean)
    .join('\n');

  const draft = await callGemini({
    system: buildStyleRules(data.bahasa, data.paragraf),
    user: `Buat character story dari data ini:\n\n${info}`,
    temperature: 1,
  });

  const rewritten = await callGemini({
    system: buildRewriteRules(data.bahasa, data.paragraf),
    user: `Fakta karakter (jangan diubah):\n\( {info}\n\nTeks yang harus ditulis ulang:\n\n \){draft}`,
    temperature: 1,
  });

  return cleanText(rewritten || draft);
}

/* ------------------------------------------------------------------ */
/* State di memori                                                     */
/* ------------------------------------------------------------------ */

const prefs = new Map();
const sessions = new Map();
const lastUse = new Map();

function getPrefs(userId) {
  if (!prefs.has(userId)) prefs.set(userId, {});
  if (prefs.size > 2000) prefs.delete(prefs.keys().next().value);
  return prefs.get(userId);
}

function saveSession(data, userId) {
  const key = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  sessions.set(key, { data, userId });
  if (sessions.size > 300) sessions.delete(sessions.keys().next().value);
  return key;
}

function cooldownLeft(userId) {
  const left = COOLDOWN_MS - (Date.now() - (lastUse.get(userId) || 0));
  return left > 0 ? Math.ceil(left / 1000) : 0;
          }

/* ------------------------------------------------------------------ */
/* UI                                                                  */
/* ------------------------------------------------------------------ */

function panelEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('AI Roleplay Character Creator')
    .setDescription(
      [
        'Buat karakter roleplay yang realistis dan mendalam dengan bantuan kecerdasan buatan.',
        '',
        '**Cara Penggunaan:**',
        '1. Pilih latar belakang kehidupan',
        '2. Pilih vibe kepribadian karakter',
        '3. Pilih bahasa cerita (Indonesia / English)',
        '4. Pilih jumlah paragraf (3-5)',
        "5. Klik **'Buat Karakter'** untuk mengisi detail",
        '6. AI akan men-generate character story lengkap',
        '',
        '📌 Pilih opsi di bawah untuk memulai',
      ].join('\n')
    )
    .setFooter({ text: FOOTER })
    .setTimestamp();
}

function panelComponents() {
  const menu = (id, placeholder, options) =>
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(id)
        .setPlaceholder(placeholder)
        .addOptions(
          options.map(([label, desc]) => ({
            label,
            value: label,
            ...(desc ? { description: desc } : {}),
          }))
        )
    );

  return [
    menu('cs_latar', '🏠 Pilih latar belakang kehidupan', LATAR),
    menu('cs_vibe', '🎭 Pilih vibe kepribadian', VIBE),
    menu('cs_bahasa', '🌐 Pilih bahasa cerita', BAHASA),
    menu('cs_paragraf', '📄 Pilih jumlah paragraf', PARAGRAF.map((n) => [n, `${n} paragraf`])),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cs_open').setLabel('📝 Buat Karakter').setStyle(ButtonStyle.Primary)
    ),
  ];
}

function buildModal() {
  const row = (id, label, style, max, placeholder, required) =>
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(style)
        .setMaxLength(max)
        .setPlaceholder(placeholder)
        .setRequired(required)
    );

  return new ModalBuilder()
    .setCustomId('cs_modal')
    .setTitle('Detail Karakter')
    .addComponents(
      row('name', 'Nama Karakter', TextInputStyle.Short, 60, 'contoh: Rendz Walker', true),
      row('age', 'Umur', TextInputStyle.Short, 3, 'contoh: 24', true),
      row('gender', 'Jenis Kelamin', TextInputStyle.Short, 10, 'male/female', true),
      row('personality', 'Deskripsi Kepribadian (Opsional)', TextInputStyle.Paragraph, 4000, 'Deskripsikan sifat, kebiasaan, keunikan...', false),
      row('extra', 'Detail Tambahan (Opsional)', TextInputStyle.Paragraph, 4000, 'Latar belakang kustom, detail spesifik, preferensi...', false)
    );
}

function regenRow(key) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cs_regen:${key}`).setLabel('🔄 Generate Ulang').setStyle(ButtonStyle.Secondary)
  );
}

async function runGeneration(interaction, data, userId) {
  lastUse.set(userId, Date.now());
  await interaction.deferReply();
  try {
    const story = await generateStory(data);
    const key = saveSession(data, userId);
    const chunks = splitText(story);
    const safe = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'karakter';
    const file = new AttachmentBuilder(Buffer.from(story, 'utf8'), { name: `cs-${safe}.txt` });

    if (chunks.length === 1) {
      await interaction.editReply({ content: chunks[0], files: [file], components: [regenRow(key)] });
      return;
    }
    await interaction.editReply({ content: chunks[0] });
    for (let i = 1; i < chunks.length; i++) {
      const last = i === chunks.length - 1;
      await interaction.followUp(
        last ? { content: chunks[i], files: [file], components: [regenRow(key)] } : { content: chunks[i] }
      );
    }
  } catch (err) {
    console.error(err);
    await interaction.editReply({ content: 'Gagal membuat character story. Coba lagi sebentar lagi.' });
  }
}

/* ------------------------------------------------------------------ */
/* Bot                                                                 */
/* ------------------------------------------------------------------ */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Login sebagai ${c.user.tag}`);
  const commands = [
    new SlashCommandBuilder()
      .setName('panel')
      .setDescription('Kirim panel AI Roleplay Character Creator ke channel ini')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setDMPermission(false)
      .toJSON(),
  ];
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    }
    console.log('Slash command terdaftar.');
  } catch (e) {
    console.error('Gagal daftar command:', e);
  }
});

const SELECT_KEYS = { cs_latar: 'latar', cs_vibe: 'vibe', cs_bahasa: 'bahasa', cs_paragraf: 'paragraf' };

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isChatInputCommand() && i.commandName === 'panel') {
      await i.reply({ content: 'Panel dikirim.', ephemeral: true });
      return await i.channel.send({ embeds: [panelEmbed()], components: panelComponents() });
    }

    if (i.isStringSelectMenu() && SELECT_KEYS[i.customId]) {
      getPrefs(i.user.id)[SELECT_KEYS[i.customId]] = i.values[0];
      return await i.deferUpdate();
    }

    if (i.isButton() && i.customId === 'cs_open') {
      const p = getPrefs(i.user.id);
      const missing = [];
      if (!p.latar) missing.push('latar belakang');
      if (!p.vibe) missing.push('vibe kepribadian');
      if (!p.bahasa) missing.push('bahasa cerita');
      if (!p.paragraf) missing.push('jumlah paragraf');
      if (missing.length) {
        return await i.reply({ content: `Pilih dulu: ${missing.join(', ')}.`, ephemeral: true });
      }
      const wait = cooldownLeft(i.user.id);
      if (wait) return await i.reply({ content: `Tunggu ${wait} detik lagi.`, ephemeral: true });
      return await i.showModal(buildModal());
    }

    if (i.isModalSubmit() && i.customId === 'cs_modal') {
      const p = getPrefs(i.user.id);
      if (!p.latar || !p.vibe || !p.bahasa || !p.paragraf) {
        return await i.reply({ content: 'Pilihan panel hilang, pilih ulang lalu klik Buat Karakter.', ephemeral: true });
      }
      const wait = cooldownLeft(i.user.id);
      if (wait) return await i.reply({ content: `Tunggu ${wait} detik lagi.`, ephemeral: true });
      const data = {
        name: i.fields.getTextInputValue('name').trim(),
        age: i.fields.getTextInputValue('age').trim(),
        gender: i.fields.getTextInputValue('gender').trim(),
        personality: i.fields.getTextInputValue('personality').trim(),
        extra: i.fields.getTextInputValue('extra').trim(),
        latar: p.latar,
        vibe: p.vibe,
        bahasa: p.bahasa,
        paragraf: p.paragraf,
      };
      return await runGeneration(i, data, i.user.id);
    }

    if (i.isButton() && i.customId.startsWith('cs_regen:')) {
      const session = sessions.get(i.customId.split(':')[1]);
      if (!session) return await i.reply({ content: 'Sesi kedaluwarsa, klik Buat Karakter lagi di panel.', ephemeral: true });
      if (session.userId !== i.user.id) return await i.reply({ content: 'Tombol ini hanya untuk pembuat cerita.', ephemeral: true });
      const wait = cooldownLeft(i.user.id);
      if (wait) return await i.reply({ content: `Tunggu ${wait} detik lagi.`, ephemeral: true });
      return await runGeneration(i, session.data, i.user.id);
    }
  } catch (e) {
    console.error('Interaction error:', e);
  }
});

/* ------------------------------------------------------------------ */
/* Prefix Command !panel                                               */
/* ------------------------------------------------------------------ */

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.content !== '!panel') return;

  if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return message.reply({
      content: 'Kamu tidak punya izin untuk menggunakan command ini.',
      allowedMentions: { repliedUser: false },
    });
  }

  try {
    await message.channel.send({
      embeds: [panelEmbed()],
      components: panelComponents(),
    });
  } catch (err) {
    console.error('Gagal kirim panel:', err);
  }
});

client.login(DISCORD_TOKEN);
