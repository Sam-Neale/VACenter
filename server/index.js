const express = require('express');
const RateLimit = require('express-rate-limit');
require('dotenv').config()
const sanitize = require("sanitize-filename");
const package = require('./../package.json')
const cv = require('./../package.json').version;
console.log(cv)
let limiter = new RateLimit({
    windowMs: 1*60*1000,
    max: 100,
    message: "Limits exceded, contact your system admin if you think this is an error."
})
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt')
const salt = 10;
const btoa = require('btoa')
const atob = require('atob')
const uniqueString = require('unique-string');
const request = require("request");

const app = express();
const urlEncodedParser = bodyParser.urlencoded({ extended: false })

let config = JSON.parse(fs.readFileSync(path.join(__dirname, "/../") + "config.json"))
let clientConfig = config

let stats = {
    userCount: 0
}

let users = new Map()
let events = new Map();
let crafts = new Map();
let ops = new Map();
let pireps = new Map();
let routes = new Map();

pireps.set("vdfhiobfdjnl", {
    id: "vdfhiobfdjnl",
    pilot:{
        name: "John"
    },
    aircraft: "B789",
    airline: "VANet",
    route: "VA0001",
    dtime: new Date(),
    atime: new Date(),
    ftime: 10,
    comments: "Zh[dfbfeqjwinvdjs",
    status: "n"
})

app.use(urlEncodedParser)
app.use(cors())
app.use(limiter)

app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs')
const publicPath = path.join(__dirname + '/../public')
const dataPath = path.join(__dirname + '/../data')
const usersPath = path.join(__dirname + '/../data/users')

function reloadData(){
    setTimeout(() => {
        try {
            events = new Map();
            crafts = new Map();
            ops = new Map();
            pireps = new Map();
            routes = new Map();
            fs.readdirSync(dataPath + "/events").forEach(event => {
                let pushedEventRaw = fs.readFileSync(dataPath + "/events" + "/" + event)
                let pushedEvent = JSON.parse(pushedEventRaw)
                events.set(pushedEvent.id, pushedEvent)
            })
            fs.readdirSync(dataPath + "/aircraft").forEach(craft => {
                let pushedCraftRaw = fs.readFileSync(dataPath + "/aircraft" + "/" + craft)
                let pushedCraft = JSON.parse(pushedCraftRaw)
                crafts.set(pushedCraft.id, pushedCraft)
            })
            fs.readdirSync(dataPath + "/operators").forEach(airline => {
                let pushedAirlineRaw = fs.readFileSync(dataPath + "/operators" + "/" + airline)
                let pushedAirline = JSON.parse(pushedAirlineRaw)
                ops.set(pushedAirline.id, pushedAirline)
            })
            fs.readdirSync(dataPath + "/pireps").forEach(pirep => {
                let pushedPirepRaw = fs.readFileSync(dataPath + "/pireps" + "/" + pirep)
                let pushedPirep = JSON.parse(pushedPirepRaw)
                pireps.set(pushedPirep.id, pushedPirep)
            })
            fs.readdirSync(dataPath + "/routes").forEach(route => {
                let pushedRouteRaw = fs.readFileSync(dataPath + "/routes" + "/" + route)
                let pushedRoute = JSON.parse(pushedRouteRaw)
                routes.set(pushedRoute.id, pushedRoute)
            })
        }
        catch (error) {
            console.log(error)
            console.log("!!!!")
        }
    }, 500);
}
reloadData()
function reloadUsers() {
    setTimeout(() => {
        try {
            stats.userCount = 0;
            fs.readdirSync(usersPath).forEach(user => {
                stats.userCount = stats.userCount + 1
                let pushedUserRaw = fs.readFileSync(usersPath + "/" + user)
                let pushedUser = JSON.parse(pushedUserRaw)
                pushedUser.usernameAtob = atob(pushedUser.username)
                delete pushedUser['password']
                delete pushedUser['tokens']
                users.set(pushedUser.username, pushedUser)
            })
        }
        catch (error) {
            console.log(error)
            console.log("!!!!")
            fs.writeFileSync(`${usersPath}/test.json`, fs.readFileSync(`${usersPath}/QURNSU4x.json`))
        }
    }, 500);

}

reloadUsers()

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
function arrayRemove(arr, value) {

    return arr.filter(function (ele) {
        return ele != value;
    });
}
function remToken(tokens) {
    const unBased = atob(tokens.authToken)
    const userID = unBased.split(":")[0];
    const realTokenPreAdjust = unBased.split(":")[1];
    if (realTokenPreAdjust) {
        const realToken = realTokenPreAdjust.slice(0, realTokenPreAdjust.length)
        const userExists = FileExists(`${usersPath}/` + sanitize(userID) + '.json').then(exists => {
            if (exists) {
                FileRead(`${usersPath}/` + sanitze(userID) + '.json').then(rawUser => {
                    const user = JSON.parse(rawUser)
                    if (user.tokens.includes(realToken)) {
                        user.tokens = arrayRemove(user.tokens, realToken);
                        FileWrite(`${usersPath}/` + sanitize(userID) + '.json', JSON.stringify(user, null, 2))
                        reloadUsers()
                    }
                })
            }
        })
    }
}

function isAdminUser(tokens) {
    return new Promise(resolve => {
        if (tokens.authToken != undefined) {

            const unBased = atob(tokens.authToken)
            const userID = unBased.split(":")[0];
            const realTokenPreAdjust = unBased.split(":")[1];
            if (realTokenPreAdjust) {
                const realToken = realTokenPreAdjust.slice(0, realTokenPreAdjust.length - 1)
                const userExists = FileExists(`${usersPath}/` + sanitize(userID) + '.json').then(exists => {
                    if (exists) {
                        FileRead(`${usersPath}/` + sanitize(userID) + '.json').then(rawUser => {
                            const user = JSON.parse(rawUser)
                            const correctToken = user.tokens.includes(realToken);
                            if (correctToken) {
                                resolve(user.admin)
                            } else {
                                resolve(false)
                            }

                        })


                    } else {
                        resolve(false);
                    }
                })

            } else {
                resolve(false)
            }
        } else {
            resolve(false)
        }
    })
}

function isNormalUser(tokens) {
    return new Promise(resolve => {
        if (tokens.authToken != undefined) {

            const unBased = atob(tokens.authToken)
            const userID = unBased.split(":")[0];
            const realTokenPreAdjust = unBased.split(":")[1];
            if (realTokenPreAdjust) {
                const realToken = realTokenPreAdjust.slice(0, realTokenPreAdjust.length - 1)
                const userExists = FileExists(`${usersPath}/` + sanitize(userID) + '.json').then(exists => {
                    if (exists) {
                        FileRead(`${usersPath}/` + sanitize(userID) + '.json').then(rawUser => {
                            const user = JSON.parse(rawUser)
                            const correctToken = (user.tokens.includes(realToken) && user.revoked == false);
                            resolve(correctToken);
                        })


                    } else {
                        resolve(false);
                    }
                })

            } else {
                resolve(false)
            }
        } else {
            resolve(false)
        }
    })

}

function getUserID(tokens){
    return new Promise(resolve => {
        if (tokens.authToken != undefined) {
            const unBased = atob(tokens.authToken)
            const userID = unBased.split(":")[0];
            resolve(userID)
        } else {
            resolve(false)
        }
    })
}

function getUserData(tokens){
    return new Promise(resolve => {
        if (tokens.authToken != undefined) {

            const unBased = atob(tokens.authToken)
            const userID = unBased.split(":")[0];
            const realTokenPreAdjust = unBased.split(":")[1];
            if (realTokenPreAdjust) {
                const realToken = realTokenPreAdjust.slice(0, realTokenPreAdjust.length - 1)
                const userExists = FileExists(`${usersPath}/` + sanitize(userID) + '.json').then(exists => {
                    if (exists) {
                        FileRead(`${usersPath}/` + sanitize(userID) + '.json').then(rawUser => {
                            const user = JSON.parse(rawUser)
                            resolve(user);
                        })


                    } else {
                        resolve(false);
                    }
                })

            } else {
                resolve(false)
            }
        } else {
            resolve(false)
        }
    })
}

app.get('*', async (req, res) => {
    const cookies = getAppCookies(req)
    const fp = req.path.slice(0, 8)
    const fp2 = req.path.slice(0, 12)
    console.log(fp2)
    if (fp == "/assets/") {
        if (fs.existsSync(publicPath + req.path)) {
            res.sendFile(publicPath + req.path)
        } else {
            res.sendStatus(404)
        }
    } else if (fp2 == "/components/") {
        if (fs.existsSync(`${__dirname}/${req.path}`)) {
            res.sendFile(`${__dirname}/${req.path}`);
        }
    } else {
        if (req.path != "/setup" && clientConfig.id == undefined) {
            res.redirect("/setup")
        } else {
            switch (req.path) {
                case "/":
                    if (cookies.hasOwnProperty('authToken')) {
                        res.redirect("/home")
                    } else {
                        res.render('login', {
                            config: clientConfig
                        })
                    }

                    break;
                case "/news":
                    if (await isNormalUser(cookies)) {
                        const uid = atob(cookies.authToken).split(":")[0];
                        const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                        if (!userInfo.meta.cp) {
                            delete userInfo['password']
                            delete userInfo['tokens']
                            //userInfo.apiKey
                            res.render('news', {
                                config: clientConfig,
                                user: userInfo,
                                active: req.path.split('/')[1]
                            })
                        } else {
                            res.redirect("/changePWD")
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/report":
                    res.render("report")
                    break;
                case "/home":
                    if (await isNormalUser(cookies)) {
                        const uid = atob(cookies.authToken).split(":")[0];
                        const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                        if (!userInfo.meta.cp) {
                            delete userInfo['password']
                            delete userInfo['tokens']
                            //userInfo.apiKey
                            res.render('home', {
                                config: clientConfig,
                                user: userInfo,
                                active: req.path.split('/')[1]
                            })
                        } else {
                            res.redirect("/changePWD")
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }

                    break;
                case "/account":
                    if (await isNormalUser(cookies)) {
                        const uid = atob(cookies.authToken).split(":")[0];
                        const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                        if (!userInfo.meta.cp) {
                            delete userInfo['password']
                            delete userInfo['tokens']
                            //userInfo.apiKey
                            res.render('account', {
                                config: clientConfig,
                                user: userInfo,
                                active: req.path.split('/')[1]
                            })
                        } else {
                            res.redirect("/changePWD")
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }

                    break;
                case "/pirep":
                    if (await isNormalUser(cookies)) {
                        const uid = atob(cookies.authToken).split(":")[0];
                        const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                        if (!userInfo.meta.cp) {
                            delete userInfo['password']
                            delete userInfo['tokens']
                            //userInfo.apiKey
                            res.render('pirep', {
                                config: clientConfig,
                                user: userInfo,
                                active: req.path.split('/')[1],
                                data: {
                                    ops: ops,
                                    crafts: crafts,
                                    routes: routes
                                }
                            })
                        } else {
                            res.redirect("/changePWD")
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/events":
                    if (await isNormalUser(cookies)) {
                        const uid = atob(cookies.authToken).split(":")[0];
                        const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                        if (!userInfo.meta.cp) {
                            delete userInfo['password']
                            delete userInfo['tokens']
                            //userInfo.apiKey
                            res.render('events', {
                                config: clientConfig,
                                user: userInfo,
                                events: events,
                                active: req.path.split('/')[1]
                            })
                        } else {
                            res.redirect("/changePWD")
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/admin/viewEvent":
                    if (await isNormalUser(cookies)) {
                        if (await isAdminUser(cookies)) {
                            const uid = atob(cookies.authToken).split(":")[0];
                            const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                            if (!userInfo.meta.cp) {
                                delete userInfo['password']
                                delete userInfo['tokens']
                                if (await FileExists(`${dataPath}/events/` + sanitize(atob(req.query.id)) + '.json')) {
                                    const targetEvent = JSON.parse(await FileRead(`${dataPath}/events/` + sanitize(atob(req.query.id)) + '.json'));
                                    res.render('admin/viewEvent', {
                                        config: clientConfig,
                                        user: userInfo,
                                        targetEvent: targetEvent,
                                        active: req.path.split('/')[1]
                                    })
                                } else {
                                    res.sendStatus(400)
                                }
                            } else {
                                res.redirect("/changePWD")
                            }
                        } else {
                            res.sendStatus(403)
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/admin/vacenter":
                    if (await isNormalUser(cookies)) {
                        if (await isAdminUser(cookies)) {
                            const uid = atob(cookies.authToken).split(":")[0];
                            const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                            if (!userInfo.meta.cp) {
                                delete userInfo['password']
                                delete userInfo['tokens']
                                res.render('admin/settings', {
                                    config: clientConfig,
                                    user: userInfo,
                                    cv: cv,
                                    active: req.path.split('/')[1]
                                })
                            } else {
                                res.redirect("/changePWD")
                            }
                        } else {
                            res.sendStatus(403)
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                    break;
                case "/admin/news":
                    if (await isNormalUser(cookies)) {
                        if (await isAdminUser(cookies)) {
                            const uid = atob(cookies.authToken).split(":")[0];
                            const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                            if (!userInfo.meta.cp) {
                                delete userInfo['password']
                                delete userInfo['tokens']
                                    res.render('admin/news', {
                                        config: clientConfig,
                                        user: userInfo,
                                        active: req.path.split('/')[1]
                                    })
                            } else {
                                res.redirect("/changePWD")
                            }
                        } else {
                            res.sendStatus(403)
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/admin/viewUser":
                    if (await isNormalUser(cookies)) {
                        if (await isAdminUser(cookies)) {
                            const uid = atob(cookies.authToken).split(":")[0];
                            const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                            if (!userInfo.meta.cp) {
                                delete userInfo['password']
                                delete userInfo['tokens']
                                if (await FileExists(`${usersPath}/` + sanitize(req.query.u) + '.json')) {
                                    const targetUser = JSON.parse(await FileRead(`${usersPath}/` + sanitize(req.query.u) + '.json'));
                                    delete targetUser['password']
                                    delete targetUser['tokens']
                                    targetUser.atobUsername = atob(targetUser.username)
                                    res.render('admin/viewUser', {
                                        config: clientConfig,
                                        user: userInfo,
                                        targetUser: targetUser,
                                        active: req.path.split('/')[1]
                                    })
                                } else {
                                    res.sendStatus(400)
                                }
                            } else {
                                res.redirect("/changePWD")
                            }
                        } else {
                            res.sendStatus(403)
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/admin/accounts":
                    if (await isNormalUser(cookies)) {
                        if (await isAdminUser(cookies)) {
                            const uid = atob(cookies.authToken).split(":")[0];
                            const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                            if (!userInfo.meta.cp) {
                                delete userInfo['password']
                                delete userInfo['tokens']
                                res.render('admin/accounts', {
                                    config: clientConfig,
                                    user: userInfo,
                                    users: users
                                })
                            } else {
                                res.redirect("/changePWD")
                            }
                        } else {
                            res.sendStatus(403)
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/admin/pireps":
                    if (await isNormalUser(cookies)) {
                        if (await isAdminUser(cookies)) {
                            const uid = atob(cookies.authToken).split(":")[0];
                            const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                            if (!userInfo.meta.cp) {
                                delete userInfo['password']
                                delete userInfo['tokens']
                                res.render('admin/pireps', {
                                    config: clientConfig,
                                    user: userInfo,
                                    pireps: pireps,
                                    routes: routes,
                                    ops: ops,
                                    craft: crafts
                                })
                            } else {
                                res.redirect("/changePWD")
                            }
                        } else {
                            res.sendStatus(403)
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/admin/events":
                    if (await isNormalUser(cookies)) {
                        if (await isAdminUser(cookies)) {
                            const uid = atob(cookies.authToken).split(":")[0];
                            const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                            if (!userInfo.meta.cp) {
                                delete userInfo['password']
                                delete userInfo['tokens']
                                res.render('admin/events', {
                                    config: clientConfig,
                                    user: userInfo,
                                    events: events
                                })
                            } else {
                                res.redirect("/changePWD")
                            }
                        } else {
                            res.sendStatus(403)
                        }
                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/changePWD":
                    if (await isNormalUser(cookies)) {
                        const uid = atob(cookies.authToken).split(":")[0];
                        const userInfo = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
                        if (userInfo.meta.cp) {
                            res.render("changePWD")
                        } else {
                            res.redirect("/")
                        }

                    } else {
                        res.clearCookie('authToken').redirect('/?r=ii')
                    }
                    break;
                case "/setup":
                    if (clientConfig.id == undefined) {
                        res.render('setup')
                    } else {
                        res.redirect("/")
                    }
                    break;
                case "/logout":
                    let CToken = cookies.authToken;
                    if(CToken){
                        const unBased = atob(CToken)
                        const userID = unBased.split(":")[0];
                        const realTokenPreAdjust = unBased.split(":")[1];
                        console.log(await FileRead(`${usersPath}/${sanitize(userID)}.json`))
                        if(userID){
                            if (await FileExists(`${usersPath}/${sanitize(userID)}.json`)){
                                const user = JSON.parse(await FileRead(`${usersPath}/${sanitize(userID)}.json`))
                                const realToken = realTokenPreAdjust.slice(0, realTokenPreAdjust.length - 1)
                                var index = user.tokens.indexOf(realToken);
                                if (index > -1) {
                                    user.tokens.splice(index, 1);
                                    FileWrite(`${usersPath}/${sanitize(userID)}.json`, JSON.stringify(user, null, 2))
                                }
                            }
                        }
                    }
                    remToken(cookies)
                    res.clearCookie('authToken').redirect('/')
                    break;
                default:
                    res.render("404")
                    break;
            }
        }
    }
})

app.post("/admin/reqs/updateEvent", async (req, res) =>{
    try {
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (await isAdminUser(cookies)) {
                if (req.body.id && req.body.title && req.body.desc && req.body.arrAir && req.body.depAir && req.body.depTime) {
                    if (await FileExists(`${dataPath}/events/${sanitize(atob(req.body.id))}.json`)) {
                        const event = JSON.parse(await FileRead(`${dataPath}/events/${sanitize(atob(req.body.id))}.json`))
                        if (event.title != req.body.title) {
                            event.title = req.body.title
                        }
                        if (event.body != req.body.desc) {
                            event.body = req.body.desc
                        }
                        if (event.arrAir != req.body.arrAir) {
                            event.arrAir = req.body.arrAir
                        }
                        if (event.depAir != req.body.depAir) {
                            event.depAir = req.body.depAir
                        }
                        if (event.depTime != req.body.depTime) {
                            event.depTime = req.body.depTime + "Z"
                        }
                        FileWrite(`${dataPath}/events/${sanitize(atob(req.body.id))}.json`, JSON.stringify(event, null, 2))
                        reloadData()
                        setTimeout(function () {
                            res.redirect("/admin/events")
                        }, 1500)
                    } else {
                        console.log(req.body)
                        res.sendStatus(404)
                    }

                } else {
                    res.sendStatus(400);
                    console.log(req.body)
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.delete("/admin/reqs/remEvent", async function (req, res){
    try {
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (await isAdminUser(cookies)) {
                if (req.body.id) {
                    if (await FileExists(`${dataPath}/events/${sanitize(atob(req.body.id))}.json`) == true){
                        FileRemove(`${dataPath}/events/${sanitize(atob(req.body.id))}.json`)
                        reloadData()
                        setTimeout(function () {
                            res.redirect("/admin/events")
                        }, 1500)
                    }else{
                        res.sendStatus(404)
                    }
                    reloadData()
                    
                } else {
                    res.sendStatus(400);
                    console.log(req.body)
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.post("/newPirep", async function (req, res){
    try{
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (req.body.vehicle && req.body.airline && req.body.route && req.body.departureT && req.body.arrivalT && req.body.flightTime && req.body.comments){
                const author = await getUserData(cookies)
                const pirepObj = {
                    id: uniqueString(),
                    vehicle: req.body.vehicle,
                    author: author.username,
                    airline: req.body.airline,
                    pilot: {
                        name: author.name
                    },
                    route: req.body.route,
                    departureT: req.body.departureT,
                    arrivalT: req.body.arrivalT,
                    flightTime: req.body.flightTime,
                    comments: req.body.comments,
                    status: "n"
                }
                author.pireps.push(pirepObj.id)
                FileWrite(`${usersPath}/${sanitize(pirepObj.author)}.json`, JSON.stringify(author, null, 2))
                reloadUsers();
                FileWrite(`${dataPath}/pireps/${pirepObj.id}.json`, JSON.stringify(pirepObj, null, 2))
                reloadData();
                res.redirect("/home")
            }else{
                res.sendStatus(400);
            }
        }else{
            res.sendStatus(401)
        }
    }catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})



app.post("/admin/reqs/newEvent", async function (req, res){
    try {
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (await isAdminUser(cookies)) {
                if (req.body.title && req.body.desc && req.body.arrAir && req.body.depAir && req.body.depTime) {
                        const event = {
                            id: uniqueString(),
                            title: req.body.title,
                            body: req.body.desc,
                            arrAir: req.body.arrAir,
                            depAir: req.body.depAir,
                            depTime: req.body.depTime + "Z"
                        }
                        FileWrite(`${dataPath}/events/${event.id}.json`, JSON.stringify(event, null, 2))
                        reloadData()
                        setTimeout(function () {
                            res.redirect("/admin/events")
                        }, 1500)
                } else {
                    res.sendStatus(400);
                    console.log(req.body)
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.post("/OSOR", async function (req, res){
    try{
        const cookies = getAppCookies(req);
        if(await isNormalUser(cookies)){
            const user = await getUserData(cookies);
            user.tokens = [];
            FileWrite(`${usersPath}/${sanitize(user.username)}.json`, JSON.stringify(user, null, 2))
            res.redirect("/logout")
        }
    }catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.post("/updateUser", async function (req, res){
    try{
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            const user = await getUserData(cookies);
            if(req.body.name){
                if(req.body.name!= user.name){
                     user.name = req.body.name
                }    
            }
            FileWrite(`${usersPath}/${sanitize(user.username)}.json`, JSON.stringify(user, null, 2))
            res.redirect("/account")
        }
    }catch (error){
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.post("/admin/reqs/updateUser", async function (req, res){
    try {
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (await isAdminUser(cookies)) {
                if (req.body.uid) {
                    if (await FileExists(`${usersPath}/${btoa(sanitize(req.body.uid))}.json`)) {
                        const user = JSON.parse(await FileRead(`${usersPath}/${btoa(sanitize(req.body.uid))}.json`))
                        console.log(req.body)
                        if(user.name != req.body.name){
                            user.name = req.body.name
                        }else{
                            console.log(user)
                        }
                        if(req.body.cpwd){
                            user.meta.cp = true
                        } else {
                            console.log(user)
                        }
                        user.tokens = [];
                        FileWrite(`${usersPath}/${btoa(sanitize(req.body.uid))}.json`, JSON.stringify(user, null, 2))
                        reloadUsers()
                        setTimeout(function() {
                            res.redirect("/admin/accounts")
                        }, 1500)
                    } else {
                        console.log(req.body)
                        res.sendStatus(404)
                    }

                } else {
                    res.sendStatus(400);
                    console.log(req.body)
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.put("/admin/reqs/unremUser", async function (req, res){
    try {
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (await isAdminUser(cookies)) {
                if (req.body.uid) {
                    if (await FileExists(`${usersPath}/${sanitize(decodeURIComponent(req.body.uid))}.json`)) {
                        const user = JSON.parse(await FileRead(`${usersPath}/${sanitize(decodeURIComponent(req.body.uid))}.json`))
                        user.revoked = false;
                        user.tokens = [];
                        FileWrite(`${usersPath}/${sanitize(decodeURIComponent(req.body.uid))}.json`, JSON.stringify(user, null, 2))
                        reloadUsers()
                        res.redirect("/admin/accounts")
                    } else {
                        res.sendStatus(404)
                    }

                } else {
                    res.sendStatus(400);
                    console.log(req.body)
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.delete("/admin/reqs/remUser", async function (req, res){
    try {
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (await isAdminUser(cookies)) {
                if (req.body.uid) {
                    if (await FileExists(`${usersPath}/${sanitize(decodeURIComponent(req.body.uid))}.json`) ) {
                        const user = JSON.parse(await FileRead(`${usersPath}/${sanitize(decodeURIComponent(req.body.uid))}.json`))
                        user.revoked = true;
                        user.tokens = [];
                        FileWrite(`${usersPath}/${sanitize(decodeURIComponent(req.body.uid))}.json`, JSON.stringify(user, null, 2))
                        reloadUsers()
                        res.redirect("/admin/accounts")
                    } else {
                        res.sendStatus(404)
                    }

                } else {
                    res.sendStatus(400);
                    console.log(req.body)
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.delete("/admin/reqs/remData", async function (req, res){
    try {
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (await isAdminUser(cookies)) {
                switch (req.query.t) {
                    case "p":
                        if (req.body.id) {
                            console.log(req.body)
                            if (await FileExists(`${dataPath}/pireps/${sanitize(req.body.id)}.json`)) {
                                const pirep = JSON.parse(await FileRead(`${dataPath}/pireps/${sanitize(req.body.id)}.json`))
                                pirep.status = "d";
                                FileWrite(`${dataPath}/pireps/${sanitize(req.body.id)}.json`, JSON.stringify(pirep, null, 2))
                                reloadData();
                                res.sendStatus(200)
                            } else {
                                res.sendStatus(404)
                            }
                        } else {
                            res.sendStatus(400)
                        }
                        break;
                    case "r":
                        if (req.body.id) {
                                if (await FileExists(`${dataPath}/routes/${sanitize(req.body.id)}.json`)) {
                                    await FileRemove(`${dataPath}/routes/${sanitize(req.body.id)}.json`);
                                    reloadData();
                                    setTimeout(() => {
                                        res.redirect("/admin/pireps")
                                    }, 1000)
                                } else {
                                    res.sendStatus(404)
                                }
                        } else {
                            res.sendStatus(400)
                        }
                        break;
                    case "a":
                        if(req.body.id){
                            if(req.body.id != "MAIN"){
                            if (await FileExists(`${dataPath}/operators/${sanitize(req.body.id)}.json`)) {
                                await FileRemove(`${dataPath}/operators/${sanitize(req.body.id)}.json`);
                                reloadData();
                                setTimeout(() => {
                                    res.redirect("/admin/pireps")
                                }, 1000)
                            } else {
                                res.sendStatus(404)
                            }
                        }else{
                            res.sendStatus(403);
                        }
                        }else{
                            res.sendStatus(400)
                        }
                        break;
                    case "c":
                        if (req.body.id) {
                            if (await FileExists(`${dataPath}/aircraft/${sanitize(req.body.id)}.json`)) {
                                await FileRemove(`${dataPath}/aircraft/${sanitize(req.body.id)}.json`);
                                reloadData();
                                setTimeout(() => {
                                    res.redirect("/admin/pireps")
                                }, 1000)
                            } else {
                                res.sendStatus(404)
                            }

                        } else {
                            res.sendStatus(400)
                        }
                        break;
                    default:
                        res.sendStatus(400)
                        break;
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

async function addHoursToPilot(uid, amount){
    if(await FileExists(`${usersPath}/${uid}.json`)){
        const user = JSON.parse(await FileRead(`${usersPath}/${uid}.json`))
        user.hours = user.hours + amount
        FileWrite(`${usersPath}/${uid}.json`, JSON.stringify(user, null, 2))
        console.log(`ADDED ${amount} hours to ${atob(uid)}`)
    }else{
        console.error("NO USER FOUND TO ADD TIME")
    }
}

app.post("/admin/reqs/newData", async function (req, res){
    try{
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (await isAdminUser(cookies)) {
                switch(req.query.t){
                    case "p":
                        if(req.body.id){
                            console.log(req.body)
                            if (await FileExists(`${dataPath}/pireps/${sanitize(req.body.id)}.json`)) {
                                const pirep = JSON.parse(await FileRead(`${dataPath}/pireps/${sanitize(req.body.id)}.json`))
                                pirep.status = "a";
                                addHoursToPilot(pirep.author, (pirep.flightTime / 60))
                                FileWrite(`${dataPath}/pireps/${sanitize(req.body.id)}.json`, JSON.stringify(pirep, null, 2))
                                reloadData();
                                res.sendStatus(200)
                            }else{
                                res.sendStatus(404)
                            }
                        }else{
                            res.sendStatus(400)
                        }
                        break;
                    case "c":
                        if(req.body.vicName){
                            let newObj = {
                                name: req.body.vicName,
                                id: uniqueString()
                            };
                            if (await FileExists(`${dataPath}/aircraft/${sanitize(newObj.id)}.json`) == false){
                                await FileWrite(`${dataPath}/aircraft/${sanitize(newObj.id)}.json`, JSON.stringify(newObj, null,2));
                                reloadData();
                                setTimeout(() => {
                                    res.redirect("/admin/pireps")
                                }, 1000)
                            }else{
                                res.sendStatus(409)
                            }
                            
                        }else{
                            res.sendStatus(400)
                        }
                        break;
                    case "r":
                        if(req.body.routeName){
                                let newObj = {
                                    name: req.body.routeName,
                                    id: uniqueString()
                                };
                                if (await FileExists(`${dataPath}/routes/${sanitize(newObj.id)}.json`) == false) {
                                    await FileWrite(`${dataPath}/routes/${sanitize(newObj.id)}.json`, JSON.stringify(newObj, null, 2));
                                    reloadData();
                                    setTimeout(() => {
                                        res.redirect("/admin/pireps")
                                    }, 1000)
                                } else {
                                    res.sendStatus(409)
                                }

                            } else {
                                res.sendStatus(400)
                            }
                        break;
                    case "a":
                        if (req.body.airName) {
                            let newObj = {
                                name: req.body.airName,
                                id: uniqueString()
                            };
                            if (await FileExists(`${dataPath}/operators/${sanitize(newObj.id)}.json`) == false) {
                                await FileWrite(`${dataPath}/operators/${sanitize(newObj.id)}.json`, JSON.stringify(newObj, null, 2));
                                reloadData();
                                setTimeout(() => {
                                    res.redirect("/admin/pireps")
                                }, 1000)
                            } else {
                                res.sendStatus(409)
                            }

                        } else {
                            res.sendStatus(400)
                        }
                        break;
                    default:
                        res.sendStatus(400)
                        break;
                }
            }else{
                res.sendStatus(403);
            }
        }else{
            res.sendStatus(401);
        }
    }catch(error){
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.post("/admin/reqs/newUser", async (req, res) => {
    try {
        const cookies = getAppCookies(req);
        if (await isNormalUser(cookies)) {
            if (await isAdminUser(cookies)) {
                if (req.body.username && req.body.password && req.body.Name && req.body.CPW) {
                    if (await FileExists(`${usersPath}/${btoa(sanitize(req.body.username))}.json`) == false) {
                        const admin = req.body.admin ? true : false;
                        const newUser = {
                            username: btoa(req.body.username),
                            rank: "AWAITING",
                            admin: admin,
                            tokens: [],
                            password: bcrypt.hashSync(req.body.password, 10),
                            notifications: [],
                            pireps: [],
                            name: req.body.Name,
                            hours: 0,
                            meta: {
                                created: new Date(),
                                llogin: null,
                                cp: true
                            },
                            revoked: false
                        }
                        FileWrite(`${usersPath}/${btoa(sanitize(req.body.username))}.json`, JSON.stringify(newUser, null, 2))
                        reloadUsers()
                        res.redirect("/admin/accounts")
                    } else {
                        res.sendStatus(409)
                    }

                } else {
                    res.sendStatus(400);
                    console.log(req.body)
                }
            } else {
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(401);
        }
    } catch (error) {
        console.error(error)
        res.status(500)
        res.send(`${error}`)
    }
})

app.post("/setupData", async function (req, res) {
    if (config.id == undefined) {
        if (req.body.key) {

            const options = {
                method: 'GET',
                url: 'https://api.vanet.app/airline/v1/profile',
                headers: { 'X-Api-Key': req.body.key }
            };

            request(options, function (error, response, body) {
                if (error) res.status(500).send(error);
                if (response.statusCode == 200) {
                    const newConfig = JSON.parse(response.body).result
                    newConfig.other = {
                        bg: "assets/images/stockBG.jpg",
                        logo: "https://va-center.com/assets/images/logo.webp"
                    }
                    fs.writeFileSync(`${__dirname}/../config.json`, JSON.stringify(newConfig, null, 2))
                    fs.writeFileSync(`${dataPath}/operators/MAIN.json`, JSON.stringify({
                        name: newConfig.name,
                        id: "MAIN"
                    }, null, 2))
                    reloadUsers()
                    reloadData()
                    config = JSON.parse(fs.readFileSync(path.join(__dirname + "/../") + "config.json"))
                    clientConfig = config
                    res.sendStatus(200)
                } else {
                    res.status(500).send(error)
                }
            });


        } else {
            res.sendStatus(400)
        }
    } else {
        res.sendStatus(401)
    }
})



app.post("/login2", async function (req, res) {
    if (req.body.token) {
        const clientToken = req.body.token
        const uid = atob(clientToken).split(":")[0]
        const token = atob(clientToken).split(":")[1]
        const userExists = await FileExists(`${usersPath}/` + sanitize(uid) + '.json')
        if (userExists) {
            const user = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'));
            if (user.revoked != true) {
                if (user.tokens.includes(token)) {
                    res.send('/home')
                    user.meta.llogin = new Date();
                    FileWrite(`${usersPath}/` + sanitize(uid) + '.json', JSON.stringify(user, null, 2))
                    reloadUsers()
                } else {
                    res.clearCookie('authToken').send('/?r=ii')
                }
            } else {
                res.clearCookie('authToken').send('/?r=ro')
            }
        } else {
            res.clearCookie('authToken').send('/?r=ii')
        }
    } else {
        res.clearCookie('authToken').send('/?r=mi')
    }
})



app.post("/login", async function (req, res) {
    if (req.body.uidI && req.body.pwdI) {
        const userExists = await FileExists(`${usersPath}/` + btoa(sanitize(req.body.uidI)) + '.json')
        if (userExists) {
            const user = JSON.parse(await FileRead(`${usersPath}/` + btoa(sanitize(req.body.uidI)) + '.json'))
            if (user.revoked == false) {
                bcrypt.compare(req.body.pwdI, user.password, async (err, same) => {
                    if (err) {
                        res.redirect('/?r=ue')
                    } else if (same) {
                        const token = await uniqueString();
                        const userwToken = user.username + ":" + token;
                        const clientToken = btoa(userwToken);
                        await user.tokens.push(token);
                        user.meta.llogin = new Date();
                        await FileWrite(`${usersPath}/` + btoa(sanitize(req.body.uidI)) + '.json', JSON.stringify(user, null, 2));
                        reloadUsers()
                        res.cookie('authToken', clientToken, { maxAge: new Date().getTime() + (10 * 365 * 24 * 60 * 60) }).redirect('/home')
                    } else {
                        res.redirect('/?r=ii')
                    }
                })
            } else {
                res.redirect('/?r=ro')
            }
        } else {
            res.redirect('/?r=ii')
        }
    } else {
        res.redirect("/?r=ni")
    }
})

app.post("/CPWD", async (req, res) => {
    const cookies = getAppCookies(req);
    if (cookies.authToken) {
        const clientToken = cookies.authToken
        const uid = atob(clientToken).split(":")[0]
        const token = atob(clientToken).split(":")[1]
        const userExists = await FileExists(`${usersPath}/` + sanitize(uid) + '.json')
        if (userExists) {
            const userData = JSON.parse(await FileRead(`${usersPath}/` + sanitize(uid) + '.json'))
            if (userData.tokens.includes(token.slice(0, token.length - 1))) {
                if (req.body.pwd) {
                    console.log(req.body)
                    userData.password = bcrypt.hashSync(req.body.pwd, 10)
                    userData.tokens = [];
                    delete userData.meta['cp']
                    FileWrite(`${usersPath}/` + sanitize(uid) + '.json', JSON.stringify(userData, null, 2));
                    reloadUsers()
                    res.clearCookie('authToken').redirect("/");
                } else {
                    res.sendStatus(400)
                }

            } else {
                res.redirect("/");
            }
        } else {
            res.sendStatus(401)
        }
    } else {
        res.sendStatus(400)
    }
})

app.listen(process.env.port)
function FileWrite(path, data) {
    return new Promise(resolve => {
        fs.writeFile(path, data, function (err) {
            if (err) {
                console.error(err)
                resolve(false)
            } else {
                resolve(true)
            }
        })
    })

}
function FileExists(path) {
    return new Promise(resolve => {
        fs.stat(path, function (err, stat) {
            if (stat != undefined) {
                resolve(true);
            } else {
                resolve(false);
            }
        })
    })

}

function FileRemove(path){
    return new Promise(resolve => {
        fs.unlink(path, function(err, data){
            resolve(err ? false: data);
            if(err){
                console.error(err)
            }
        })
    })
}

function FileRead(path) {
    return new Promise(resolve => {
        fs.readFile(path, function (err, data) {
            resolve(err ? false : data);
            if (err) {
                console.error(err)
            }
        })
    })
}
console.log(uniqueString())

const fetch = require('node-fetch');

function checkForNewVersion(){
return new Promise(resolve => {
    const options = {
        method: 'GET',
        url: 'https://raw.githubusercontent.com/VACenter/VACenter/updateInfo/info.json',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        form: {}
    };

    request(options, function (error, response, body) {
        if (error) throw new Error(error);

        const returned = JSON.parse(body);
        if (cv != returned.currentVersion) {
            resolve([true, returned.currentVersion]);

        } else {
            resolve([false, null])
        }
    });
})
}
async function update(version){
    let url = "https://raw.githubusercontent.com/VACenter/VACenter/updateInfo/info.json";

    let settings = { method: "Get" };

    fetch(url, settings)
        .then(res => res.json())
        .then((json) => {
            console.log(json)
            package.version = version;
            console.log(package)
            fs.writeFileSync(`${path.join(__dirname, "/../") + "package.json"}`, JSON.stringify(package, null, 2))
            let proccessed = 0;
            json.versions[version].FilesChanged.forEach(file =>{
                const gitPath = `https://raw.githubusercontent.com/VACenter/VACenter/master/${file}`;
                const filePath = path.join(__dirname, '/../', file)
                
                console.log(filePath)
                
                const options = {
                    method: 'GET',
                    url: gitPath
                };

                request(options, function (error, response, body) {
                    if (error) throw new Error(error);
                    fs.writeFileSync(`${filePath}`, body)
                    proccessed++;
                    if (proccessed === json.versions[version].FilesChanged.length) {
                        process.exit(1)
                        
                    }
                });
                
            })
            
        });
}

app.post("/update", async function (req, res){
    const cookies = getAppCookies(req)
    if(await isNormalUser(cookies)){
        if(await isAdminUser(cookies)){
            updater()
            res.sendStatus(200)
        }else{
            res.sendStatus(401)
        }
    }else{
        res.sendStatus(403)
    }
})

async function updater(){
    const updateRequired = await checkForNewVersion()
    if(updateRequired[0] == true){
        update(updateRequired[1])
    }
}
updater()
//console.log(path.resolve(__dirname, '../'))


function updateTest(){
    const val = fs.readFileSync(`${__dirname}/test.txt`).toString();
    console.log("This is pid " + process.pid);
    console.log(val)
    if(val == 1){
        fs.writeFileSync(`${__dirname}/test.txt`, "0")
        process.exit(1)
    }
}

//updateTest()