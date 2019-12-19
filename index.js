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
/**
 * mode 'inline', affichage de la liste dans les messages
 * mode 'keyboard', affichage de la liste sous forme de keyboard
 */
const mode = "inline";

const bot = new Telegraf(process.env.BOT_TOKEN);
const i18n = new TelegrafI18n({
    defaultLanguage: 'en',
    allowMissing: true,
    directory: path.resolve(__dirname, 'locales')
});
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
bot.command('add', (ctx) => {
    var text = ctx.message.text;
    if (text.startsWith('/add@') == false) {
        text = ctx.message.text.substring(5);
        if (text.length > 0) {
            var textArray = text.split(',');
            for (var i in textArray) {
                Todo.create({
                    text: textArray[i].trim(),
                    done: false,
                    creator: ctx.from.first_name + ' ' + ctx.from.last_name,
                    creatorId: ctx.from.id,
                    chatId: ctx.chat.id
                }, function (err, data) {
                    console.log(data._doc.text);
                    findAllTodosByUser(ctx, 'text', 'ajouté ' + data._doc.text);
                });
            }
        }
    } else {
        findAllTodosByUser(ctx);
    }
});
/**
 * Commande /list
 */
bot.command('list', (ctx) => {
    findAllTodosByUser(ctx, ctx.message.text.substring(6), ctx.i18n.t('list'));
});
/**
 * En mode 'inline', la suppression se fait par callback sur l'id
 */
bot.on('callback_query', ctx => {
    // get info from callback_query object
    var id = ctx.update.callback_query.data;
    console.log("callback id", id);
    findTodoById(ctx,id, function (err, data) {
        if (data != null) {
            console.log("callback id", data._id);
            Todo.deleteOne({
                "_id": data._id
            }, function (error, todo) {
                if (error) {
                    ctx.reply(error);
                    console.log(error);
                }
                findAllTodosByUser(ctx, "text", ctx.update.callback_query.from.first_name + ' ' + ctx.update.callback_query.from.last_name + ' ' + ctx.i18n.t('deleted') + ' ' + data.text);
            })
        } else {
            findAllTodosByUser(ctx);
        }
    });
});
/**
 * Mode 'keyboard', la suppression se fait par nom
 * Mode 'inline', teste '🔍 Liste'
 */
bot.on('text', (ctx) => {
    console.log("text", ctx.update.message.text);
    const button_list = ctx.i18n.t('button_list');
    if (ctx.update.message.text == button_list) {
        findAllTodosByUser(ctx, 'text',  ctx.i18n.t('list'));
    } else if (mode == 'keyboard') {
        findTodoByText(ctx,ctx.update.message.text, function (err, data) {
            if (data != null) {
                console.log("callback id", data._id);
                Todo.deleteOne({
                    "_id": data._id
                }, function (error, todo) {
                    if (error) {
                        ctx.reply(error);
                        console.log(error);
                    }
                    //console.log(error, data);
                    findAllTodosByUser(ctx, "text", ctx.update.message.from.first_name + ' ' + ctx.update.message.from.last_name + " a supprimé " + data.text);
                })
            } else {
                findAllTodosByUser(ctx, 'text', button_list);
            }
        });
    }
});
bot.catch((err, ctx) => {
    console.log('Ooops, ecountered an error for ${ctx.updateType}', err)
});
bot.launch();
/**
 * Affiche de la liste en mode 'inline' ou 'keyboard'.
 * En mode 'inline', on affiche un keyboard, avec la commande Liste
 * @param {*} ctx 
 * @param {*} sort, trié par text ou date 
 * @param {*} title, titre, en mode inline, si title='liste', alors on affiche la liste
 */
function findAllTodosByUser(ctx, sort, title) {
    console.log("findAllTodosByUser", sort, title);
    const button_list = ctx.i18n.t('button_list');
    if (mode == "inline" && (typeof title=="undefined" || title.toLowerCase() != ctx.i18n.t('list').toLowerCase())) {
        ctx.reply(typeof title == "undefined" ? ctx.i18n.t('list') : title,
            Markup.keyboard([Markup.callbackButton(button_list, '/list')])
                .resize()
                .extra()
        );
    } else {
        if (sort != "date") sort = "text";
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
                        var arrayReply2 = new Array();
                    }
                    
                }
                //ctx.reply(arrayReply0.join(','));
                arrayReply1.push(arrayReply2);
                if (mode == 'inline') {
                    ctx.reply(arrayReply0.join(', '),
                        Markup.inlineKeyboard(arrayReply1)
                            //.resize()
                            .extra()
                    );
                    //ctx.reply( ctx.i18n.t('list'),
                    //    Markup.keyboard([Markup.callbackButton(button_list, '/list')])
                    //        .resize()
                    //        .oneTime()
                    //        .extra()
                    //);
                } else {
                    ctx.reply(typeof title == "undefined" ? ctx.i18n.t('list') : title,
                        Markup.keyboard(arrayReply1)
                            .resize()
                            .extra()
                    );
                }
            });
    }
}
/**
 * Recherche par id
 * @param {*} id 
 * @param {*} callback 
 */
function findTodoById(ctx,id, callback) {
    console.log("findTodosById", id);
    Todo.findOne({$and:[{'_id':id},{'chatId':ctx.chat.id}]})
        .exec(function (err, todo) {
            if (err) {
                console.log("findTodosById", err);
            }
            console.log("findTodosById", todo);
            callback(err, todo);
        });
}
/**
 * Recherche par text
 * @param {*} text 
 * @param {*} callback 
 */
function findTodoByText(ctx,text, callback) {
    console.log("findTodosByText", text);
    Todo.findOne({$and:[{'text':text},{'chatId':ctx.chat.id}]})
        .exec(function (err, todo) {
            if (err) {
                console.log("findTodosByText", err);
            }
            console.log("findTodoByText", todo);
            callback(err, todo);
        });
}
