//variable d'environnement
require('dotenv').config();
const path = require("path");
//condif mongodb
var db = require('./config/database')
//modèle todo
var Todo = require('./model/TodosModel');
//telegraf
const Telegraf = require('telegraf');
const session = require('telegraf/session');
const TelegrafI18n = require('telegraf-i18n');
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');

const bot = new Telegraf(process.env.BOT_TOKEN);
const i18n = new TelegrafI18n({
    defaultLanguage: 'en',
    allowMissing: true,
    directory: path.resolve(__dirname, 'locales')
});

const cmdList = 'list';
const cmdAdd = 'add';

bot.use(session());
bot.use(i18n.middleware())
bot.use((ctx, next) => {
    console.log("ctx", ctx);//, "ctx.from", ctx.from, "ctx.chat", ctx.chat);
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
    Todo.deleteMany({ 'chatId': ctx.chat.id }, function (err) {
        ctx.reply(ctx.from.first_name + ' ' + ctx.from.last_name + ' ' + ctx.i18n.t('deleteAllReturn'));
    });
    setUserModeAdd(ctx, false);
});
/**
 * jeu de test
 */
bot.command('test', (ctx) => {
    console.log("command test");
    var text = "chocolat,farine,sucre,oeufs,boeuf,poulet,saumon,levure,salade,coca,jus de fruits,eau pétillante,desserts,glace vanille,sorbets";
    addTodo(ctx, text);
    findAllTodosByUser(ctx, 'text', 'Init list ' + text);
    setUserModeAdd(ctx, false);
});
/**
 * Commande ajout
 */
bot.command('add', (ctx) => {
    console.log("command add", ctx.message.text);
    var text = ctx.message.text;
    if (text.startsWith('/add@'))
        text = '/add';
    if (text.startsWith('/add')) {
        text = ctx.message.text.substring(5);
        if (text.length > 0) {
            addTodo(ctx, text, function () { findAllTodosByUser(ctx, 'text', ctx.i18n.t('added') + ' ' + text) });
        } else {
            ctx.reply(ctx.i18n.t('addWhat'), { reply_to_message_id: ctx.message.message_id, force_reply: true, selective: true });
            setUserModeAdd(ctx, true);
        }
    } else {
        findAllTodosByUser(ctx);
    }
});
/**
 * Commande /list
 */
bot.command('list', (ctx) => {
    console.log("command list");
    setUserModeAdd(ctx, false);
    findAllTodosByUser(ctx, ctx.message.text.substring(6), cmdList);
});
/**
 * La suppression se fait par callback sur l'id
 */
bot.on('callback_query', ctx => {
    // get info from callback_query object
    var id = ctx.update.callback_query.data;
    console.log("callback id", id);
    findTodoById(ctx, id, function (err, data) {
        if (data != null) {
            console.log("callback id", data._id);
            Todo.deleteOne({
                "_id": data._id
            }, function (error, todo) {
                if (error) {
                    ctx.reply(error);
                    console.log(error);
                } else {
                    //ctx.reply(ctx.update.callback_query.from.first_name + ' ' + ctx.update.callback_query.from.last_name + ' ' + ctx.i18n.t('deleted') + ' ' + data.text);
                    findAllTodosByUser(ctx, "text", ctx.update.callback_query.from.first_name + ' ' + ctx.update.callback_query.from.last_name + ' ' + ctx.i18n.t('deleted') + ' ' + data.text);
                }

            })
        } else {
            findAllTodosByUser(ctx);
        }
    });
    setUserModeAdd(ctx, false);
});
bot.on('text', (ctx) => {
    console.log("text", ctx.update.message.text);
    var text = ctx.update.message.text;
    if (text.startsWith('/')) {
        if (text.indexOf(' ') > 0)
            text = text.substring(text.indexOf(' ') + 1);
        else text = '';
    }
    if (text.length > 0 && isUserModeAdd(ctx))
        addTodo(ctx, text, function () { findAllTodosByUser(ctx, 'text', ctx.i18n.t('added') + ' ' + text) });
});
bot.catch((err, ctx) => {
    console.log('Ooops, ecountered an error for ${ctx.updateType}', err)
});
bot.launch();
/**
 * Affiche de la liste
 *
 * @param {*} ctx 
 * @param {*} sort, trié par text ou date 
 * @param {*} title, titre
 */
function findAllTodosByUser(ctx, sort, title) {
    console.log("findAllTodosByUser", sort, title);
    if (sort != "date") sort = "text";
    if (title !== cmdList && typeof title !== 'undefined' && title.length > 0) ctx.reply(title);
    Todo.find()
        .where('chatId')
        .equals(ctx.chat.id)
        .sort(sort)
        .exec(function (err, todos) {
            if (err) {
                console.log(err);
            }
            var arrayReply0 = new Array();
            var arrayReply1 = new Array();
            var arrayReply2 = new Array();
            var cpt = 0;
            for (var todo in todos) {
                arrayReply0.push(todos[todo].text);
                arrayReply2.push(Markup.callbackButton(todos[todo].text, todos[todo].id));
                cpt++;
                if (cpt != 0 && cpt % 4 == 0) {
                    arrayReply1.push(arrayReply2);
                    arrayReply2 = new Array();
                }

            }
            //ctx.reply(arrayReply0.join(','));
            arrayReply1.push(arrayReply2);
            const reply = arrayReply0.join(', ').length == 0 ? ctx.i18n.t('empty') : arrayReply0.join(', ');
            const markup = Markup.inlineKeyboard(arrayReply1).oneTime().extra();
            //console.log(arrayReply0.join(', ').length);
            if (reply.length > 0) {
                if (title !== cmdList && typeof ctx.session.listMessageId !== 'undefined') {
                    ctx.telegram.editMessageText(ctx.chat.id, ctx.session.listMessageId, ctx.session.listInlineMessageId, reply, markup).then(function (replyCtx) { });
                } else {
                    ctx.reply(reply, markup)
                        .then(function (replyCtx) {
                            console.log("replyCtx", replyCtx);
                            ctx.session.listMessageId = replyCtx.message_id;
                            ctx.session.listInlineMessageId = replyCtx.inline_message_id
                        });
                }
            }
        });
}
/**
 * Recherche par id
 * @param {*} id 
 * @param {*} callback 
 */
function findTodoById(ctx, id, callback) {
    console.log("findTodosById", id);
    Todo.findOne({ $and: [{ '_id': id }, { 'chatId': ctx.chat.id }] })
        .exec(function (err, todo) {
            if (err) console.log("findTodosById", err);
            //console.log("findTodosById", todo);
            callback(err, todo);
        });
}
/**
 * Recherche par text
 * @param {*} text 
 * @param {*} callback 
 */
function findTodoByText(ctx, text, callback) {
    console.log("findTodosByText", text);
    Todo.findOne({ $and: [{ 'text': text }, { 'chatId': ctx.chat.id }] })
        .exec(function (err, todo) {
            if (err) console.log("findTodosByText", err);
            console.log("findTodoByText", todo);
            if (callback) callback(err, todo);
        });
}
function addTodo(ctx, text, callback) {
    if (typeof text === 'string') {
        var textArray = text.split(',');
        var todos = new Array();
        for (var i in textArray) {
            todos.push({
                text: textArray[i].trim(),
                done: false,
                creator: ctx.from.first_name + ' ' + ctx.from.last_name,
                creatorId: ctx.from.id,
                chatId: ctx.chat.id
            });
        }
        Todo.insertMany(todos, function (err, data) {
            if (!err) console.log("added : " + text);
            if (callback) callback(err, data);
        });
    } else if (callback) callback();
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
/**
 * 
 * @param {*} ctx 
 */
function getUserSession(ctx) {
    if (typeof ctx.session.users === 'undefined') ctx.session.users = {};
    var user = {};
    var id = ctx.from.id;
    if (ctx.session.users.hasOwnProperty(id)) {
        user = ctx.session.users[id];
    } else {
        user.modeAdd = false;
        ctx.session.users[id] = user;
    }
    return user;
}
/**
 * 
 * @param {*} ctx 
 * @param {*} datas 
 */
function setUserSession(ctx, datas) {
    if (typeof ctx.session.users === 'undefined') ctx.session.users = new Array();
    ctx.session.users[ctx.from.id] = datas;
}