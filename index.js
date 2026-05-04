//variable d'environnement
require('dotenv').config();
const path = require("path");
//condif mongodb
var db = require('./config/database')
//modèle todo
var Todo = require('./model/TodosModel');
var History = require('./model/HistoryModel');
//telegraf v4
const { Telegraf, Markup, session } = require('telegraf');
const TelegrafI18n = require('telegraf-i18n');
const sessionStore = require('./middleware/sessionStore');
const rateLimit = require('./middleware/rateLimit');

const bot = new Telegraf(process.env.BOT_TOKEN);
const i18n = new TelegrafI18n({
    defaultLanguage: 'en',
    allowMissing: true,
    directory: path.resolve(__dirname, 'locales')
});

const cmdList = 'list';
const cmdAdd = 'add';
const buttonsByRow = parseInt(process.env.BUTTONS_BY_ROW, 10) || 3;
/**
 * Durée de la session utilisateur 20 minutes
 */
const sessionDelay = 20 * 60 * 1000;
var nextPurge = Date.now() + sessionDelay;

bot.use(rateLimit({ window: 3000, max: 5 }));
bot.use((ctx, next) => {
    console.log('update', ctx.updateType, ctx.message ? ctx.message.text : (ctx.callbackQuery ? 'cb:' + ctx.callbackQuery.data : ''));
    return next();
});
bot.use(session({
    store: sessionStore,
    defaultSession: () => ({}),
    getSessionKey: (ctx) => {
        if (ctx.from && ctx.chat) return `${ctx.from.id}:${ctx.chat.id}`;
        if (ctx.from) return `${ctx.from.id}:${ctx.from.id}`;
        return undefined;
    },
}));
bot.use(i18n.middleware())
bot.use((ctx, next) => {
    if (process.env.DEBUG === '1') console.log("ctx", ctx);
    purgeUserSession(ctx);
    return next(ctx)
});
bot.start((ctx) => {
    ctx.reply('Welcome!')
});
//bot.help((ctx) => ctx.reply('Send me a sticker'));
/**
 * Commande d'ajout. Ajout multiples avec séparateur ','
 */
bot.command('delall', (ctx) => {
    console.log("command delall");
    setUserModeDeleteAll(ctx, true);
    setUserModeAdd(ctx, false);
    ctx.reply(ctx.i18n.t('addConfirmDeleteAll'), {
        ...Markup.forceReply(),
        reply_parameters: { message_id: ctx.message.message_id },
    }).catch((e) => console.log('reply delall', e.message));
});
/**
 * jeu de test
 */
bot.command('test', (ctx) => {
    console.log("command test");
    var text = "chocolat,farine,PQ,sucre,,œufs,boeuf,poulet,saumon,levure,salade,coca,jus de fruits,eau pétillante,desserts,glace vanille,sorbets";
    setUserModeAdd(ctx, false);
    return new Promise((resolve) => {
        addTodo(ctx, text, async () => {
            await findAllTodosByUser(ctx, 'text', 'Init list ' + text);
            resolve();
        });
    });
});
/**
 * Commande ajout
 */
bot.command('add', async (ctx) => {
    try {
        console.log("command add", ctx.message.text);
        var text = ctx.message.text;
        if (text.startsWith('/add@'))
            text = '/add';
        if (text.startsWith('/add')) {
            text = text.substring(5);
            if (text.length > 0) {
                await new Promise((resolve) => addTodo(ctx, text, resolve));
                await findAllTodosByUser(ctx, 'text', ctx.i18n.t('added') + ' ' + text);
            } else {
                const suggestions = await getSuggestions(ctx);
                const replyOpts = {
                    disable_notification: true,
                    reply_parameters: { message_id: ctx.message.message_id },
                };
                if (suggestions.length > 0) {
                    Object.assign(replyOpts, Markup.keyboard(chunk(suggestions, buttonsByRow)).oneTime().resize());
                }
                await ctx.reply(ctx.i18n.t('addWhat'), replyOpts).catch((e) => console.log('reply addWhat', e.message));
                setUserModeAdd(ctx, true);
                console.log('mode add ON for', getSessionKey(ctx));
            }
        } else {
            await findAllTodosByUser(ctx);
        }
    } catch (e) {
        console.log(e);
    }
});
/**
 * Commande /list
 */
bot.command('list', async (ctx) => {
    console.log("command list");
    setUserModeAdd(ctx, false);
    await findAllTodosByUser(ctx, ctx.message.text.substring(6), cmdList);
});
/**
 * Vide le panier (produits cochés)
 */
bot.command('clean', async (ctx) => {
    console.log("command clean");
    setUserModeAdd(ctx, false);
    const result = await Todo.deleteMany({ chatId: ctx.chat.id, done: true });
    const who = ctx.from.first_name + ' ' + ctx.from.last_name;
    await findAllTodosByUser(ctx, 'text', `${who} ${ctx.i18n.t('cleanReturn')} (${result.deletedCount})`);
});
/**
 * La suppression se fait par callback sur l'id
 */
bot.on('callback_query', async (ctx) => {
    try {
        var id = ctx.update.callback_query.data;
        console.log("callback id", id);
        await ctx.answerCbQuery().catch(() => {});
        const data = await new Promise((resolve) => findTodoById(ctx, id, resolve));
        setUserModeAdd(ctx, false);
        if (data != null) {
            const newDone = !data.done;
            await Todo.updateOne({ _id: data._id }, { $set: { done: newDone, doneAt: newDone ? new Date() : null } });
            const who = ctx.update.callback_query.from.first_name + ' ' + ctx.update.callback_query.from.last_name;
            const verb = newDone ? ctx.i18n.t('checked') : ctx.i18n.t('unchecked');
            await findAllTodosByUser(ctx, "text", `${who} ${verb} ${data.text}`);
        } else {
            await findAllTodosByUser(ctx);
        }
    } catch (e) {
        console.log(e);
    }
});
bot.on('text', async (ctx) => {
    try {
        console.log("text", ctx.update.message.text, 'modeAdd=', isUserModeAdd(ctx), 'modeDelAll=', isUserModeDeleteAll(ctx));
        var text = ctx.update.message.text;
        if (text.startsWith('/')) {
            if (text.indexOf(' ') > 0)
                text = text.substring(text.indexOf(' ') + 1);
            else text = '';
        }
        if (text.length > 0 && isUserModeAdd(ctx)) {
            await new Promise((resolve) => addTodo(ctx, text, resolve));
            await findAllTodosByUser(ctx, 'text', ctx.i18n.t('added') + ' ' + text);
            razUserSession(getUserSession(ctx));
        }
        if (isUserModeDeleteAll(ctx) && (text.toLowerCase() == 'y' || text.toLowerCase() == 'o')) {
            await Todo.deleteMany({ 'chatId': ctx.chat.id });
            await ctx.reply(ctx.from.first_name + ' ' + ctx.from.last_name + ' ' + ctx.i18n.t('deleteAllReturn')).catch((e) => console.log('reply delall', e.message));
            razUserSession(getUserSession(ctx));
        }
    } catch (e) {
        console.log(e);
    }
});
bot.catch((err, ctx) => {
    console.log(`Ooops, encountered an error for ${ctx && ctx.updateType}`, err && (err.stack || err))
});

// Menu de commandes affiché sur "/"
bot.telegram.setMyCommands([
    { command: 'list',   description: 'Afficher la liste' },
    { command: 'add',    description: 'Ajouter un produit (ex: /add lait,pain)' },
    { command: 'clean',  description: 'Vider le panier (produits cochés)' },
    { command: 'delall', description: 'Tout supprimer (avec confirmation o/y)' },
]).catch((e) => console.log('setMyCommands', e.message));

bot.launch();

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
/**
 * Affiche de la liste
 *
 * @param {*} ctx 
 * @param {*} sort, trié par text ou date 
 * @param {*} title, titre
 */
async function findAllTodosByUser(ctx, sort, title) {
    try {
        console.log("findAllTodosByUser", sort, title);
        if (sort != "date") sort = "text";
        if (title !== cmdList && typeof title !== 'undefined' && title.length > 0) ctx.reply(title).catch((e) => console.log('reply title', e.message));
        const query = { "chatId": ctx.chat.id };
        const cursor = Todo.find(query).sort(sort).collation({
            locale: "en",
            strength: 2,
            numericOrdering: true,
        });
        if ((await Todo.countDocuments(query)) === 0) {
            console.log("No documents found!");
        }
        const todoItems = [];
        const doneItems = [];
        for await (const todo of cursor) {
            if (todo.text.trim().length < 1) {
                console.log("delete empty :", todo._id);
                Todo.deleteOne({ "_id": todo._id })
                    .then(() => console.log("delete ok"))
                    .catch((error) => console.log(error));
            } else if (todo.done) {
                doneItems.push(todo);
            } else {
                todoItems.push(todo);
            }
        }
        // Construction des boutons : à acheter d'abord, puis panier (préfixés ✓)
        const buttonsRows = [];
        let row = [];
        const pushRow = () => { if (row.length) { buttonsRows.push(row); row = []; } };
        for (const t of todoItems) {
            row.push(Markup.button.callback(t.text, t.id));
            if (row.length >= buttonsByRow) pushRow();
        }
        if (todoItems.length && doneItems.length) pushRow(); // séparateur visuel
        for (const t of doneItems) {
            row.push(Markup.button.callback('✓ ' + t.text, t.id));
            if (row.length >= buttonsByRow) pushRow();
        }
        pushRow();
        // Construction du texte
        let reply;
        if (todoItems.length === 0 && doneItems.length === 0) {
            reply = ctx.i18n.t('empty');
        } else {
            const parts = [];
            if (todoItems.length > 0) {
                parts.push(`${ctx.i18n.t('toBuy')} (${todoItems.length})\n` + todoItems.map(t => t.text).join(', '));
            }
            if (doneItems.length > 0) {
                parts.push(`${ctx.i18n.t('inBasket')} (${doneItems.length})\n` + doneItems.map(t => '~' + t.text + '~').join(', '));
            }
            if (todoItems.length === 0 && doneItems.length > 0) {
                parts.push(ctx.i18n.t('allChecked'));
            }
            reply = parts.join('\n\n');
        }
        const markup = Markup.inlineKeyboard(buttonsRows);
        if (reply.length > 0) {
            if (title !== cmdList && typeof ctx.session.listMessageId !== 'undefined') {
                try {
                    await ctx.telegram.editMessageText(ctx.chat.id, ctx.session.listMessageId, ctx.session.listInlineMessageId, reply, markup);
                } catch (e) {
                    console.log('editMessageText fallback', e.message);
                    try {
                        const replyCtx = await ctx.reply(reply, markup);
                        ctx.session.listMessageId = replyCtx.message_id;
                        ctx.session.listInlineMessageId = replyCtx.inline_message_id;
                    } catch (e2) { console.log('reply fallback', e2.message); }
                }
            } else {
                try {
                    const replyCtx = await ctx.reply(reply, markup);
                    ctx.session.listMessageId = replyCtx.message_id;
                    ctx.session.listInlineMessageId = replyCtx.inline_message_id;
                } catch (e) { console.log('reply list', e.message); }
            }
        }
    } catch (e) {
        console.error(e);
    }
}
/**
 * Recherche par id
 * @param {*} id 
 * @param {*} callback 
 */
async function findTodoById(ctx, id, callback) {
    try {
        console.log("findTodosById", id);
        const query = {
            _id: id,
            chatId: ctx.chat.id
        }
        const todo = await Todo.findOne(query);
        if (callback) callback(todo);
    } catch (e) {
        console.log(e);
    }
}
/**
 * Recherche par text
 * @param {*} text 
 * @param {*} callback 
 */
async function findTodoByText(ctx, text, callback) {
    try {
        console.log("findTodosByText", text);
        const query = {
            text: text,
            chatId: ctx.chat.id
        }
        const todo = await Todo.findOne(query);
        if (callback) callback(todo);
    } catch (e) {
        console.log(e);
    }
}
function addTodo(ctx, text, callback) {
    try {
        if (typeof text === 'string') {
            var textArray = text.split(/\r\n|\r|\n|,|;/);
            var todos = new Array();
            var historyOps = new Array();
            for (var i in textArray) {
                const t = textArray[i].trim();
                if (t.length > 0) {
                    todos.push({
                        text: t,
                        done: false,
                        creator: ctx.from.first_name + ' ' + ctx.from.last_name,
                        creatorId: ctx.from.id,
                        chatId: ctx.chat.id
                    });
                    historyOps.push({
                        updateOne: {
                            filter: { chatId: ctx.chat.id, text: t },
                            update: { $inc: { count: 1 }, $set: { lastUsed: new Date() } },
                            upsert: true,
                        }
                    });
                }
            }
            Todo.insertMany(todos).then(function (datas) {
                console.log("added : " + text);
                if (historyOps.length > 0) {
                    History.bulkWrite(historyOps).catch((e) => console.log('history bulk', e.message));
                }
                if (callback) callback(datas);
            });
        } else if (callback) callback();
    } catch (e) {
        console.log(e);
    }
}
/**
 * Renvoie le top des produits historiques pour ce chat,
 * en excluant ceux déjà dans la liste active (non done).
 */
async function getSuggestions(ctx, limit = 12) {
    try {
        const active = await Todo.find({ chatId: ctx.chat.id, done: false }).select('text').lean();
        const activeSet = new Set(active.map(t => t.text));
        const top = await History.find({ chatId: ctx.chat.id })
            .sort({ count: -1, lastUsed: -1 })
            .limit(limit * 2)
            .lean();
        return top.map(h => h.text).filter(t => !activeSet.has(t)).slice(0, limit);
    } catch (e) {
        console.log('getSuggestions', e.message);
        return [];
    }
}
function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}
/**
 * 
 * @param {*} ctx 
 */
function isUserModeAdd(ctx) {
    return getUserSession(ctx).modeAdd;
}
function setUserModeAdd(ctx, value) {
    var user = getUserSession(ctx);
    user.modeAdd = value;
}
function isUserModeDeleteAll(ctx) {
    return getUserSession(ctx).modeDeleteAll;
}
function setUserModeDeleteAll(ctx, value) {
    var user = getUserSession(ctx);
    user.modeDeleteAll = value;
}
/**
 * 
 * @param {*} ctx 
 */
function getUserSession(ctx) {
    try {
        if (typeof ctx.session.users === 'undefined') ctx.session.users = {};
        var user = {};
        var id = getSessionKey(ctx);
        if (ctx.session.users.hasOwnProperty(id)) {
            user = ctx.session.users[id];
            user.sessionExpire = Date.now() + sessionDelay;
        } else {
            razUserSession(user);
            ctx.session.users[id] = user;
        }
        return user;
    } catch (e) {
        console.log(e);
    }
}
/**
 * 
 * @param {*} user 
 */
function razUserSession(user) {
    user.modeAdd = false;
    user.modeDeleteAll = false;
    user.sessionExpire = Date.now() + sessionDelay;
}
/**
 * 
 * @param {*} ctx 
 * @param {*} datas 
 */
function setUserSession(ctx, datas) {
    if (typeof ctx.session.users === 'undefined') ctx.session.users = {};
    datas.sessionExpire = Date.now() + sessionDelay;
    ctx.session.users[getSessionKey(ctx)] = datas;
}
/**
 * Calcul de la key session
 * @param {*} ctx 
 */
function getSessionKey(ctx) {
    if (ctx.from && ctx.chat) {
        return `${ctx.from.id}:${ctx.chat.id}`;
    } else if (ctx.from && ctx.inlineQuery) {
        return `${ctx.from.id}:${ctx.from.id}`;
    }
    return null
}
/**
 * Purge des sessions untilisateurs
 * @param {*} ctx 
 */
function purgeUserSession(ctx) {
    try {
        if (nextPurge < Date.now()) {
            if (typeof ctx.session.users === 'undefined') ctx.session.users = {};
            for (const key in ctx.session.users) {
                if (typeof ctx.session.users[key].sessionExpire === 'undefined' || ctx.session.users[key].sessionExpire < Date.now()) {
                    delete ctx.session.users[key];
                }
            };
            nextPurge = Date.now() + sessionDelay;
        }
    } catch (e) {
        console.log(e);
    }
}