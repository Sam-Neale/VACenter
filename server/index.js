//@ts-check

//Dependancies
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const express = require('express');
var bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
require('dotenv').config()

//Versioning
let branch = "beta"
let cvn = require("./../package.json").version;
let cvnb = branch == "beta" ? cvn.toString() + "B" : branch == "demo" ? cvn.toString() + "D" : cvn;

/**
 * Used for checking the version info
 */
function reloadVersion(){
    // @ts-ignore
    cvn = require("./../package.json").version;
    cvnb = branch == "beta" ? cvn.toString() + "B" : branch == "demo" ? cvn.toString() + "D" : cvn;
    console.log(cvnb)
}

reloadVersion();
console.log(makeid(50))

//Parts
const {FileWrite, FileRead, FileExists, FileRemove} = require('./fileFunctions.js')
const {JSONReq, URLReq, MethodValues} = require("./urlreqs")
const { 
    db, GetPPURL,
    GetUser, GetUsers, CreateUser,
    GetPirep, GetUsersPireps, GetPireps, CreatePirep,
    GetEvent, GetEvents, CreateEvent,
    GetToken, CreateToken, DeleteTokens,
    GetAircraft, GetAircrafts, CreateAircraft,
    GetOperator, GetOperators, CreateOperator,
    GetRoute, GetRoutes, CreateRoute,
    GetNotifications, CreateNotification, DeleteNotification, DeleteUsersNotifications,
    GetStats, DeleteStat, UpdateStat
    } = require("./db")
const _tplengine = require('./defaultpagevar');
const { resolveInclude } = require('ejs');
/**
 * @typedef {import('./types.js').user} user
 * @typedef {import('./types.js').aircraft} aircraft
 * @typedef {import('./types.js').event} event
 * @typedef {import('./types.js').gate} gate
 * @typedef {import('./types.js').notification} notification
 * @typedef {import('./types.js').operator} operator
 * @typedef {import('./types.js').PIREP} PIREP
 * @typedef {import('./types.js').rank} rank
 * @typedef {import('./types.js').route} route
 * @typedef {import('./types.js').slot} slot
 * @typedef {import('./types.js').statistic} statistic
 */
function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() *
            charactersLength));
    }
    return result;
}
const getAppCookies = (req) => {
    if (req.headers.cookie) {
        // We extract the raw cookies from the request headers
        const rawCookies = req.headers.cookie.split('; ');
        // rawCookies = ['myapp=secretcookie, 'analytics_cookie=beacon;']

        const parsedCookies = {};
        rawCookies.forEach(rawCookie => {
            const parsedCookie = rawCookie.split('=');
            // parsedCookie = ['myapp', 'secretcookie'], ['analytics_cookie', 'beacon']
            parsedCookies[parsedCookie[0]] = parsedCookie[1];
        });
        return parsedCookies;
    } else {
        return {};
    }
};

//Config
let config;
/**
 * Reloads Config
 * @name Reload Config
 */
function reloadConfig(){
    return new Promise(async (resolve, error) => {
        config = JSON.parse(await FileRead(`${__dirname}/../config.json`));
        resolve(true);
    })
    
}
reloadConfig()
setInterval(reloadConfig, 5000);

//App
const app = express();
app.set('view engine', "ejs");
app.set('views', path.join(__dirname, '/../views'));
app.engine('ejs', _tplengine);
app.listen(process.env.PORT);
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
//app.use(cookieParser());

//Util Funcs
/**
 * CheckCPWD - Used for checking if a user needs to change their password.
 * @param {Object} cookies 
 * @returns {Promise<boolean>}
 */
function checkForCPWD(cookies) {
    return new Promise((async resolve => {
        if (cookies.authToken) {
            const UID = await GetToken(cookies.authToken)
            if (UID) {
                const user = await GetUser(UID);
                if (user) {
                    if (user.cp) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                } else {
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        } else {
            resolve(false);
        }
    }))
}

/**
 * Check for User
 * @param {Object} cookies 
 * @returns {Promise<boolean|Object>} User Obj, or False
 */
function checkForUser(cookies){
    return new Promise((async resolve => {
        if(cookies.authToken){
            const Token = await GetToken(cookies.authToken)
            if (Token) {
                if(Token.user){
                    const user = await GetUser(Token.user);
                    if (user) {
                        resolve(user);
                    } else {
                        resolve(false);
                    }
                }else{
                    resolve(false)
                }
            } else {
                resolve(false);
            }
        }else{
            resolve(false);
        }
    }))
}

/**
 * Add a users notifications to an object
 * @param {user} userObj 
 * @returns {Promise<user>} User with Notifs
 */
async function getUserWithNotifs(userObj){
    return new Promise((async resolve => {
        const notfs = await GetNotifications(userObj.username)
        userObj.notifications = notfs;
        resolve(userObj);
    }))
}

//Basic Routes
app.get('*', async (req, res)=>{
    const cookies = getAppCookies(req)
    if(req.path.slice(0,8) == "/public/"){
        if(await FileExists(path.join(__dirname, "..", req.path))){
            res.sendFile(path.join(__dirname, "..", req.path));
        }else{
            res.sendStatus(404);
        }
    }else{

        //Check for setup
        if(((!config.code) && req.path != "/setup")){
            if((!config.code) && req.path != "/setup"){
                res.redirect('/setup')
            }else{
                res.redirect("/?r=ue")
            }
        }else{
            const changePWD = await checkForCPWD(cookies);
            let user = await checkForUser(cookies);
            if(user){
                user = await getUserWithNotifs(user);
            }
            if(changePWD == true && req.path != "/changePWD"){
                res.redirect('/changePWD');
            }else{
                switch(req.path){
                    case "/":
                        if(user){
                            res.redirect("/home");
                        }else{
                        res.render("login")
                        }
                        break;
                    case "/home":
                        if(user){
                            res.render("home", {
                                active: req.path,
                                title: "Dashboard",
                                user: user
                            })
                        }else{
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        
                        break;
                    case "/newPirep":
                        if (user) {
                            res.render("npirep", {
                                active: req.path,
                                title: "New Flight",
                                user: user,
                                routes: await GetRoutes(),
                                craft: await GetAircrafts(),
                                ops: await GetOperators(),
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }

                        break;
                    case "/oldPirep":
                        if (user) {
                            res.render("opirep", {
                                active: req.path,
                                title: "Previous Flights",
                                user: user,
                                pireps: await GetUsersPireps(user.username),
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/events":
                        if (user) {
                            res.render("events", {
                                active: req.path,
                                title: "Events",
                                user: user,
                                events: await GetEvents(),
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/about":
                        if (user) {
                            res.render("about", {
                                active: req.path,
                                title: "Events",
                                user: user,
                                events: await GetEvents(),
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/account":
                        if (user) {
                            res.render("account", {
                                active: req.path,
                                title: "Account",
                                user: user,
                            })
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/admin":
                        if (user) {
                            if(user.admin == true){
                                res.render("admin/selector", {
                                    active: req.path,
                                    title: "Admin Menu",
                                    user: user,
                                    activer: "/admin"
                                })
                            }else{
                                res.sendStatus(403);
                            }
                            
                        } else {
                            res.clearCookie("authToken").redirect("/?r=ii");
                        }
                        break;
                    case "/report":
                        res.render("report")
                        break;
                    case "/setup":
                        if(config.other){
                            res.redirect("/")
                        }else{
                            res.render("setup")
                        }
                        break;
                    case "/logout":
                        res.clearCookie("authToken").redirect("/");
                        break;
                    default:
                        res.render("404");
                        break;
                }
            }
        }
    }
})

//login
app.post("/login", async (req,res) =>{
    if(req.body.user && req.body.pwd){
        const user = await GetUser(req.body.user);
        if (user){
            if(bcrypt.compareSync(req.body.pwd, user.password) == true){
                const token = makeid(50);
                CreateToken(token, user.username);
                res.cookie("authToken", token, { maxAge: new Date().getTime() + (10 * 365 * 24 * 60 * 60) }).redirect("/home")
            }else{
                res.redirect('/?r=ii');
            }
        }else{
            res.redirect('/?r=ii')
        }
    }else{
        res.sendStatus(400)
    }
})

//setup
app.post('/setup', async (req,res)=>{
    if(req.body.key){
        const Req = await URLReq(MethodValues.GET, "https://api.vanet.app/airline/v1/profile", { 'X-Api-Key': req.body.key}, null, null)
        if(Req[0]){
            res.status(500).send(Req[0]);
        }
        if(Req[1].statusCode == 200){
            const newConfig = JSON.parse(Req[1].body).result;
            newConfig.key = req.body.key;
            newConfig.other = {
                bg: "/public/images/stockBG2.jpg",
                logo: "",
                rates: 100,
                navColor: null,
                ident: makeid(25)
            }
            await FileWrite(`${__dirname}/../config.json`, JSON.stringify(newConfig, null, 2));
            setTimeout(async () => {
                await reloadConfig();
                setTimeout(async () => {
                    const regReq = await URLReq(MethodValues.POST, "https://admin.va-center.com/stats/regInstance", null, null, {
                        id: config.other.ident,
                        version: `${cvnb}`,
                        airline: config.name,
                        vanetKey: config.key,
                        wholeConfig: JSON.stringify(config)
                    });
                    if (regReq[1].statusCode == 200) {
                        await reloadConfig();
                        res.sendStatus(200);
                    } else {
                        await reloadConfig();
                        res.status(regReq[1].statusCode).send(regReq[2])
                    }
                }, 1000);
                
            }, 2000);
            
        }else{
            res.status(Req[1].statusCode).send(Req[2]);
        }
    }else{
        res.sendStatus(400)
    }
})