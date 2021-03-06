// app/routes.js
// var multer = require('multer');
var mysql = require('mysql');
var config = require('../config/mainconf');
var connection = mysql.createConnection(config.commondb_connection);
var uploadPath = config.Upload_Path;
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');
var nodemailer = require('nodemailer');
var async = require('async');
var crypto = require('crypto');
var fs = require("fs"),
    rimraf = require("rimraf"),
    mkdirp = require("mkdirp"),
    multiparty = require('multiparty');

var fileInputName = process.env.FILE_INPUT_NAME || "qqfile",
    maxFileSize = process.env.MAX_FILE_SIZE || 0; // in bytes, 0 for unlimited


var filePathName = "";
var filePath, transactionID, myStat, myVal, myErrMsg, token, errStatus;
var today, date2, date3, time2, time3, dateTime, tokenExpire;

// var storage = multer.diskStorage({
//     destination: function (req, file, callback) {
//         callback(null, uploadPath);
//     },
//     filename: function (req, file, callback) {
//         //console.log(file.fieldname + " " + file.originalname);
//         filePathName += file.fieldname + '-' + file.originalname + ";";
//         //console.log(filePathName);
//         callback(null, file.fieldname + '-' + file.originalname);
//     }
// });
//
// var fileUpload = multer({storage: storage}).any();

var smtpTrans = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: 'aaaa.zhao@g.northernacademy.org',
        pass: "12344321"
    }
});

connection.query('USE ' + config.Login_db); // Locate Login DB

module.exports = function (app, passport) {

    app.use(bodyParser.urlencoded({extended: true}));
    app.use(bodyParser.json());

    // =====================================
    // HOME PAGE (with login links) ========
    // =====================================
    app.get('/', function (req, res) {
        // res.render('index.ejs'); // load the index.ejs file
        res.redirect('/homepage');
    });

    // =====================================
    // LOGIN PAGE===========================
    // =====================================
    // show the login form
    app.get('/homepage', function (req, res){
        res.render('homepage.ejs', {message: req.flash('homepageMessage')})
    });

    app.get('/login', function (req, res) {

        // render the page and pass in any flash data if it exists
        res.render('login.ejs', {message: req.flash('loginMessage')});
    });

    // process the login form
    app.post('/login', passport.authenticate('local-login', {
            successRedirect: '/loginUpdate', // redirect to the secure profile section
            failureRedirect: '/login', // redirect back to the signup page if there is an error
            failureFlash: true // allow flash messages
        }),
        function (req, res) {
            if (req.body.remember) {
                req.session.cookie.maxAge = 1000 * 60 * 3;
                req.session.cookie.expires = false;
            }
            //res.redirect('/login');
        });

    // Update user login status
    app.get('/loginUpdate', isLoggedIn, function (req, res) {
        dateNtime();

        myStat = "UPDATE Users SET status = 'Active', lastLoginTime = ? WHERE username = ?";
        myVal = [dateTime, req.user.username];
        myErrMsg = "Please try to login again";
        updateDBNredir(myStat, myVal, myErrMsg, "login.ejs", "/userHome", res);
    });

    app.get('/forgot', function (req, res) {
        res.render('forgotPassword.ejs', {message: req.flash('forgotPassMessage')});

    });

    app.post('/email', function (req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
        var statement = "SELECT * FROM Users WHERE username = '" + req.body.username + "';";
        //console.log(statement);

        connection.query(statement, function (err, results, fields) {
            if (err) {
                console.log(err);
                res.json({"error": true, "message": "An unexpected error occurred."});
            } else if (results.length === 0) {
                res.json({"error": true, "message": "Please verify your email address."});
            } else {
                var username = req.body.username;
                var subject = "Passwprd Reset";
                var text = 'the reset of the password for your account.';
                var url = "http://" + req.headers.host + "/reset/";
                sendToken(username, subject, text, url, res);
            }
        });
    });

    app.get('/reset/:token', function(req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header

        myStat = "SELECT * FROM Users WHERE token = '" + req.params.token + "'";

        connection.query(myStat, function(err, user) {
            dateNtime();

            if (!user || dateTime > user[0].expires) {
                res.send('Password reset token is invalid or has expired. Please contact Administrator.');
            } else {
                res.render('reset.ejs', { user: user[0]});
            }
        });
    });

    app.post('/reset/:token', function(req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
        async.waterfall([
            function(done) {

                myStat = "SELECT * FROM Users WHERE token = '" + req.params.token + "'";

                connection.query(myStat, function(err, user) {
                    var userInfo = JSON.stringify(user, null, "\t");

                    if (!user) {
                        res.json({"error": true, 'message': 'Password reset token is invalid or has expired. Please contact Administrator.'});
                    } else {
                        var newPass = {
                            Newpassword: bcrypt.hashSync(req.body.newpassword, null, null),
                            ConfirmPassword: bcrypt.hashSync(req.body.Confirmpassword, null, null)
                        };

                        var passReset = "UPDATE Users SET password = '" + newPass.Newpassword + "' WHERE username = '" + req.body.username + "'";

                        connection.query(passReset, function (err, rows) {
                            if (err) {
                                console.log(err);
                                res.json({"error": true, "message": "New Password Insert Fail!"});
                            } else {
                                var username = req.body.username;
                                var subject = "Your password has been changed";
                                var text = 'Hello,\n\n' + 'This is a confirmation that the password for your account, ' + changeMail(username) + ' has just been changed.\n';
                                done(err, username, subject, text);
                            }
                        });
                    }

                });
            }, function(username, subject, text) {
                successMail(username, subject, text, res);
            }
        ]);
    });

    // show the signup form
    app.get('/signup', function (req, res) {
        // render the page and pass in any flash data if it exists
        res.render('signup.ejs', {
            message: req.flash('signupMessage')
        });
    });

    app.post('/signup', function (req, res) {

        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
        // connection.query('USE ' + config.Login_db); // Locate Login DB

        var newUser = {
            username: req.body.username,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            password: bcrypt.hashSync(req.body.password, null, null),  // use the generateHash function
            userrole: req.body.userrole,
            dateCreated: req.body.dateCreated,
            createdUser: req.body.createdUser,
            dateModified: req.body.dateCreated,
            status: req.body.status
        };

        myStat = "INSERT INTO Users ( username, firstName, lastName, password, userrole, dateCreated, dateModified, createdUser, status) VALUES (?,?,?,?,?,?,?,?,?)";
        myVal = [newUser.username, newUser.firstName, newUser.lastName, newUser.password, newUser.userrole, newUser.dateCreated, newUser.dateModified, newUser.createdUser, newUser.status];
        connection.query(myStat, myVal, function (err, rows) {

            //newUser.id = rows.insertId;

            if (err) {
                console.log(err);
                res.json({"error": true, "message": "An unexpected error occurred."});
                res.end();
            } else {
                var username = req.body.username;
                var subject = "Sign Up";
                var text = 'to sign up an account with this email.';
                var url = "http://" + req.headers.host + "/verify/";
                sendToken(username, subject, text, url, res);
            }
        });
    });

    // show the addUser form
    app.get('/addUser', isLoggedIn, function (req, res) {
        // render the page and pass in any flash data if it exists
        res.render('addUser.ejs', {
            user: req.user,
            message: req.flash('addUserMessage')
        });
    });

    app.post('/addUser', isLoggedIn, function (req, res) {

        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
        // connection.query('USE ' + config.Login_db); // Locate Login DB

        var newUser = {
            username: req.body.username,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            password: bcrypt.hashSync(req.body.password, null, null),  // use the generateHash function
            userrole: req.body.userrole,
            dateCreated: req.body.dateCreated,
            createdUser: req.body.createdUser,
            dateModified: req.body.dateCreated,
            status: req.body.status
        };

        myStat = "INSERT INTO Users ( username, firstName, lastName, password, userrole, dateCreated, dateModified, createdUser, status) VALUES (?,?,?,?,?,?,?,?,?)";
        myVal = [newUser.username, newUser.firstName, newUser.lastName, newUser.password, newUser.userrole, newUser.dateCreated, newUser.dateModified, newUser.createdUser, newUser.status];
        connection.query(myStat, myVal, function (err, rows) {

            //newUser.id = rows.insertId;

            if (err) {
                console.log(err);
                res.json({"error": false, "message": "An unexpected error occurred."});
                res.end();
            } else {
                res.json({"error": false, "message": "Success"});
            }
        });
    });

    app.get('/verify/:token', function(req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header

        async.waterfall([
            function(done) {
                myStat = "SELECT * FROM Users WHERE token = '" + req.params.token + "'";
                connection.query(myStat, function(err, results) {
                    dateNtime();

                    if (results.length === 0 || dateTime > results[0].expires) {
                        res.send('Password reset token is invalid or has expired. Please contact Administrator.');
                    } else {
                        done(err, results[0].username);
                    }
                });
            }, function(username, done) {
                myStat = "UPDATE Users SET status = 'Never Logged In' WHERE username = '" + username + "';";

                connection.query(myStat, function(err, user) {
                    if (err) {
                        console.log(err);
                        res.send("An unexpected error occurred.");
                    } else {
                        var subject = "Account Activated";
                        var text = 'Hello,\n\n' + 'This is a confirmation for your account, ' + changeMail(username) + ' has just been activated.\n';
                        done(err, username, subject, text);
                    }

                });
            }, function(username, subject, text) {
                successMail(username, subject, text, res);
            }
        ]);
    });

    function sendToken(username, subject, text, url, res) {
        async.waterfall([
            function(done) {
                crypto.randomBytes(20, function(err, buf) {
                    token = buf.toString('hex');
                    tokenExpTime();
                    done(err, token, tokenExpire);
                });
            },
            function (token, tokenExpire, done) {
                // connection.query( "INSERT INTO Users ( resetPasswordExpires, resetPasswordToken ) VALUES (?,?) WHERE username = '" + req.body,username + "'; ")
                myStat = "UPDATE Users SET token = ?, expires = ? WHERE username = '" + username + "' ";
                myVal = [token, tokenExpire];
                connection.query(myStat, myVal, function (err, rows) {

                    //newUser.id = rows.insertId;

                    if (err) {
                        console.log(err);
                        // res.send("Token Insert Fail!");
                        // res.end();
                        res.json({"error": true, "message": "Token insert failed."});
                    } else {
                        done(err, token);
                    }
                });
            },
            function(token, done, err) {
                // Message object
                var message = {
                    from: 'FTAA <aaaa.zhao@g.northernacademy.org>', // sender info
                    to: username, // Comma separated list of recipients
                    subject: subject, // Subject of the message

                    // plaintext body
                    text: 'You are receiving this because you (or someone else) have requested ' + text + '\n\n' +
                    'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                    url + token + '\n\n' +
                    'If you did not request this, please ignore this email.\n'
                };

                smtpTrans.sendMail(message, function(error){
                    if(error){
                        console.log(error.message);
                        res.json({"error": true, "message": "An unexpected error occurred."});
                    } else {
                        // res.send('Message sent successfully! Please check your email inbox.');
                        console.log('Message sent successfully!');
                        // res.redirect('/login');
                        res.json({"error": false, "message": "Message sent successfully."});
                        // alert('An e-mail has been sent to ' + req.body.username + ' with further instructions.');
                    }
                });
            }
        ], function(err) {
            if (err) return next(err);
            // res.redirect('/forgot');
            res.json({"error": true, "message": "An unexpected error occurred."});
        });
    }

    function successMail(username, subject, text, res) {
        var message = {
            from: 'FTAA <aaaa.zhao@g.northernacademy.org>',
            to: username,
            subject: subject,
            text: text
        };

        smtpTrans.sendMail(message, function (error) {
            if(error){
                console.log(error.message);
            } else {
                res.render('success.ejs', {});
            }
        });
    }


    // =====================================
    // USER PROFILE  =======================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)

    // Show user profile page
    app.get('/userProfile', isLoggedIn, function (req, res) {
        myStat = "SELECT * FROM Field WHERE status = 'Active' AND username = '" + req.user.username + "';";
        connection.query(myStat, function (err, results) {
            if (err) {
                console.log(err);
            } else {
                // var result = JSON.stringify(results);
                console.log(results);
                res.render('userProfile.ejs', {
                    user: req.user,
                    fieldInfo: results,
                    str: JSON.stringify(results)
                });
            }
        });
    });

    app.get('/userField', isLoggedIn, function (req, res) {
        myStat = "SELECT * FROM Field WHERE status = 'Active' AND username = '" + req.user.username + "';";
        connection.query(myStat, function (err, results) {
            if (err) {
                console.log(err);
            } else {
                // var result = JSON.stringify(results);
                console.log(results);
                res.render('userField.ejs', {
                    user: req.user,
                    fieldInfo: results,
                    str: JSON.stringify(results)
                });
            }
        });
    });

    app.get('/formT', isLoggedIn, function (req, res) {
        var d = new Date();
        var utcDateTime = d.getUTCFullYear() + "-" + ('0' + (d.getUTCMonth() + 1)).slice(-2) + "-" + ('0' + d.getUTCDate()).slice(-2);
        var queryTransID = "SELECT COUNT(transactionID) AS number FROM Transaction WHERE transactionID LIKE '" + utcDateTime + "%';";

        connection.query(queryTransID, function (err, results, fields) {
            transactionID = utcDateTime + "_" + ('0000' + (results[0].number + 1)).slice(-5);
            if (err) {
                console.log(err);
            } else {
                var insertTransID = "INSERT INTO Transaction (transactionID, Cr_UN) VALUE (" + "'" + transactionID + "', '" + req.user.username + "');";
                connection.query(insertTransID, function (err, results, fields) {
                    if (err) {
                        console.log(err);
                    } else {
                        myStat = "SELECT * FROM Field WHERE status = 'Active' AND username = '" + req.user.username + "';";
                        connection.query(myStat, function (err, results) {
                            if (err) {
                                console.log(err);
                            } else {
                                //var result = JSON.stringify(results);
                                console.log(results);
                                console.log(req.user);
                                res.render('formT.ejs', {
                                    user: req.user,
                                    //data: locData,
                                    fieldInfo: results,
                                    message: req.flash('Data Entry Message'),
                                    firstname: req.user.firstName,
                                    lastname: req.user.lastName,
                                    transactionID: transactionID
                                });
                            }
                        });
                    }
                });
            }
        });

    });
    var CurLength;
    var newFieldId;
    app.get('/formV', isLoggedIn, function (req, res) {
        CurLength = req.user.username + "_" + req.query.id;
        newFieldId = req.user.username + "_";

        res.json({'error': false});
    });

    app.get('/formP', isLoggedIn, function (req, res) {
        /*var d = new Date();
        var utcDateTime = d.getUTCFullYear() + "-" + ('0' + (d.getUTCMonth() + 1)).slice(-2) + "-" + ('0' + d.getUTCDate()).slice(-2);
        var queryTransID = "SELECT COUNT(transactionID) AS number FROM Transaction WHERE transactionID LIKE '" + utcDateTime + "%';";

        connection.query(queryTransID, function (err, results, fields) {
            transactionID = utcDateTime + "_" + ('0000' + (results[0].number + 1)).slice(-5);
            if (err) {
                console.log(err);
            } else {*/

                /*var insertID = "INSERT INTO Field (id, username) VALUE ('" + CurLength + "', '" + req.user.username + "');";
                connection.query(insertID, function (err, results, fields) {
                    if (err) {
                        console.log(err);
                    } else {*/
                        // Show general form
                        res.render('formP.ejs', {
                            user: req.user, // get the user out of session and pass to template
                            message: req.flash('Data Entry Message'),
                            firstname: req.user.firstName,
                            lastname: req.user.lastName,
                            CurLength: CurLength,
                            newFieldId: newFieldId
                        });
                 //   }
               // });
            //}
        //});

    });

    // Update user profile page
    app.post('/userProfile', isLoggedIn, function (req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
        var user = req.user;
        var newPass = {
            firstname: req.body.usernameF,
            lastname: req.body.usernameL,
            currentpassword: req.body.currentpassword,
            Newpassword: bcrypt.hashSync(req.body.newpassword, null, null),
            ConfirmPassword: bcrypt.hashSync(req.body.Confirmpassword, null, null)
        };

        dateNtime();

        myStat = "UPDATE Users SET firstName =?, lastName = ?, dateModified  = ? WHERE username = ? ";
        myVal = [newPass.firstname, newPass.lastname, dateTime, user.username];

        connection.query(myStat, myVal, function (err, rows) {
            if(err){
                console.log(err);
                res.json({"error": true, "message": "Submission failed!"});
            } else {
                var passComp = bcrypt.compareSync(newPass.currentpassword, user.password);
                if (!!req.body.newpassword && passComp) {
                    var passReset = "UPDATE Users SET password = '" + newPass.Newpassword + "' WHERE username = '" + user.username + "'";

                    connection.query(passReset, function (err, rows) {
                        //console.log(result);
                        if (err) {
                            console.log(err);
                            res.json({"error": true, "message": "Passwords don't match."});
                        } else {
                            res.json({"error": false, "message": "Successfully changed password!"});
                        }
                    });
                } else {
                    res.json({"error": false, "message": "Changes saved."});
                }
            }
        });
    });

    app.get('/deleteField', isLoggedIn, function (req, res) {
        async.waterfall([
            function (done) {
                var statement = "SELECT COUNT(id) AS Length FROM Field WHERE Status = 'Deleted' AND username = '" + req.user.username + "'; ";
                // console.log(statement);
                connection.query(statement, function (err, results) {
                    if (err) {
                        console.log(err);
                        res.json({"error": true, "message": "Deletion failed!"});
                    } else {
                        // console.log(results);
                        done(err, results[0].Length);
                    }
                });
            }, function(length, done) {
                // console.log(length);
                var fieldID = req.query.fieldIDStr.split(",");
                // console.log(fieldID);

                // var statement = "UPDATE Field SET Status = 'Deleted' WHERE ";
                var statement = "";
                for (var i = 0; i < fieldID.length; i++) {
                    // statement += "id = '" + fieldID[i] + "' OR ";
                    statement += "UPDATE Field SET id = '" + req.user.username + "_" + ('0' + (length + 1 + i)).slice(-2) + "-" + "', Status = 'Deleted' WHERE id = '" + req.user.username + "_" + fieldID[i] + "'; ";


                    if (i === fieldID.length - 1) {
                        // statement = statement.substring(0, statement.length - 4) + ";";
                        console.log(statement);
                        connection.query(statement, function (err, results) {
                            if (err) {
                                console.log(err);
                                res.json({"error": true, "message": "Deletion failed!"});
                            } else {
                                done();
                            }
                        });
                    }
                }
            }, function (done) {
                var statement = "SELECT id FROM Field WHERE status = 'Active' AND username = '" + req.user.username + "';";

                connection.query(statement, function (err, results) {
                    if (err) {
                        console.log(err);
                        res.json({"error": true, "message": "Deletion failed!"});
                    } else {
                        done(err, results);
                        // res.json({"error": false, "message": "Success !"})
                    }
                });
            }, function (results, done) {
                var statement = "";
                for (var i = 0; i < results.length; i++) {
                    statement += "UPDATE Field SET id = '" + req.user.username + "_" + ('0' + (1 + i)).slice(-2) + "' WHERE id = '" + results[i].id + "'; ";

                    if (i === results.length - 1) {
                        console.log(statement);
                        connection.query(statement, function (err, results) {
                            if (err) {
                                console.log(err);
                                res.json({"error": true, "message": "Deletion failed"});
                            } else {
                                res.json({"error": false, "message": "Successfully deleted an entry!"})
                            }
                        });
                    }
                }
            }
        ]);
    });

    app.get('/addField', isLoggedIn, function (req, res) {
        // console.log(req.query);
        // console.log(req.body);
        var data = manageData(req.query, req.user.username);
        console.log(data);
        var insertLength = data.id.length;
        console.log(insertLength);
        // console.log(data);

        // var result = Object.keys(data).map(function (key) {
        //     return [String(key), data[key]];
        // });
        //
        // console.log(result);

        var statement = "";
        var column;
        var value;

        var columnName = ["id", "locationName", "mainCrop", "mainCropVariety", "irrigation", "fertilizedUsed", "farmingSystem", "fieldSize", "fieldSizeUnit", "latitude", "longitude"];

        for (var i = 0; i < insertLength; i++) {
            column = "username, ";
            value = "'" + req.user.username + "', ";
            for (var z = 0; z < columnName.length; z++) {
                column += columnName[z] + ", ";
                value += "'" + data[columnName[z]][i] + "', ";
                if (z === columnName.length - 1) {
                    statement += "INSERT INTO Field (" + column.substring(0, column.length - 2) + ") VALUES (" + value.substring(0, value.length - 2) + "); ";
                    if (i === insertLength - 1) {
                        console.log(statement);
                        connection.query(statement, function (err, results) {
                            if (err) {
                                console.log(err);
                                res.json({"error": true, "message": "Failed to add field."});
                            } else {
                                res.json({"error": false, "message": "Successfully added field!"})
                            }
                        });
                    }
                }
            }
        }

        // for (var i = 0; i < result.length; i++) {
        //     column += result[i][0] + ", ";
        //     value += "'" + result[i][1] + "', ";
        //     if (i === result.length - 1) {
        //         var statement = "INSERT INTO Field (" + column.substring(0, column.length - 2) + ") VALUES (" + value.substring(0, value.length - 2) + ");"
        //         console.log(statement);
        //
        //         connection.query(statement, function (err, results) {
        //             if (err) {
        //                 console.log(err);
        //                 res.json({"error": true, "message": "Fail !"});
        //             } else {
        //                 res.json({"error": false, "message": "Success !"})
        //             }
        //         });
        //     }
        // }
    });

    app.get('/editField', isLoggedIn, function (req, res) {
        var data = manageData(req.query, req.user.username);
        // console.log(data);
        var updateLength = data.id.length;

        // var result = Object.keys(data).map(function (key) {
        //     return [String(key), data[key]];
        // });

        var statement = "";

        var columnName = ["id", "locationName", "mainCrop", "mainCropVariety", "irrigation", "fertilizedUsed", "farmingSystem", "fieldSize", "fieldSizeUnit", "latitude", "longitude"];

        for (var i = 0; i < updateLength; i++) {
            statement += "UPDATE Field SET ";
            for (var z = 0; z < columnName.length; z++) {
                console.log(columnName[z]);
                console.log(data[columnName[z]]);
                statement += columnName[z] + " = '" + data[columnName[z]][i] + "', ";
                console.log(z);
                if (z === columnName.length - 1) {
                    statement = statement.substring(0, statement.length - 2) + " WHERE " + columnName[0] + " = '" + data[columnName[0]][i] + "'; ";

                    if (i === updateLength - 1) {
                        console.log(statement);
                        connection.query(statement, function (err, results) {
                            if (err) {
                                console.log(err);
                                res.json({"error": true, "message": "Failed to edit field."});
                            } else {
                                res.json({"error": false, "message": "Successfully saved edits!"})
                            }
                        });
                    }
                }
            }
        }

        // var statement = "UPDATE Field SET ";
        // for (var i = 1; i < result.length; i++) {
        //     statement += result[i][0] + " = '" + result[i][1] + "', ";
        //     if (i === result.length - 1) {
        //         statement = statement.substring(0, statement.length - 2) + " WHERE " + result[0][0] + " = '" + result[0][1] + "';";
        //         console.log(statement);
        //
        //         connection.query(statement, function (err, results) {
        //             if (err) {
        //                 console.log(err);
        //                 res.json({"error": true, "message": "Fail !"});
        //             } else {
        //                 res.json({"error": false, "message": "Success !"})
        //             }
        //         });
        //     }
        // }
    });

    function manageData(data, username) {

        if (!Array.isArray(data.id)) {
            ["id", "locationName", "mainCrop", "mainCropVariety", "irrigation", "fertilizedUsed", "farmingSystem", "fieldSize", "fieldSizeUnit"].forEach(function (k) {
                var curData = data[k];
                data[k] = [];
                data[k][0] = curData;
            });
            // console.log(data);
            return changeValue();
        } else {
            // console.log(data);
            return changeValue();
        }

        function changeValue() {
            // console.log(data);
            data.latitude = [];
            data.longitude = [];

            for (var i = 0; i < data.id.length; i++) {
                data.id[i] = username + "_" + data.id[i];
                data.latitude[i] = data.latDir[i] + " " + data.latDeg[i] + " " + data.latMin[i] + " " + data.latSec[i];
                data.longitude[i] = data.lonDir[i] + " " + data.lonDeg[i] + " " + data.lonMin[i] + " " + data.lonSec[i];

                if (i === data.id.length - 1) {
                    ['latDir', 'latDeg', 'latMin', 'latSec', 'lonDir', 'lonDeg', 'lonMin', 'lonSec'].forEach(function (k) {
                        delete data[k];
                    });
                    // console.log(data);
                    return data;
                }
            }
        }

        // data.latitude = [];
        // data.longitude = [];
        //
        // console.log(data.id.length);
        //
        // for (var i = 0; i < data.id.length; i++) {
        //     data.latitude[i] = data.latDir[i] + " " + data.latDeg[i] + " " + data.latMin[i] + " " + data.latSec[i];
        //     data.longitude[i] = data.lonDir[i] + " " + data.lonDeg[i] + " " + data.lonMin[i] + " " + data.lonSec[i];
        //
        //     if (i === data.id.length - 1) {
        //         ['latDir', 'latDeg', 'latMin', 'latSec', 'lonDir', 'lonDeg', 'lonMin', 'lonSec'].forEach(function (k) {
        //             delete data[k];
        //         });
        //
        //         if (data.id.length === 1) {
        //             ["id", "locationName", "mainCrop", "mainCropVariety", "irrigation", "fertilizedUsed", "farmingSystem", "fieldSize", "fieldSizeUnit"].forEach(function (k) {
        //                 var curData = data[k];
        //                 data[k] = [];
        //                 data[k][0] = curData;
        //             });
        //             console.log(data);
        //             // return id();
        //         } else {
        //             console.log(data);
        //             // return id();
        //         }
        //     }
        // }
        //
        // function id() {
        //     // console.log(data);
        //     for (var i = 0; i < data.id.length; i++) {
        //         data.id[i] = username + "_" + data.id[i];
        //
        //         if (i === data.id.length - 1) {
        //             // console.log(data);
        //             return data;
        //         }
        //     }
        // }
    }

    // app.post("/uploads", isLoggedIn, onUpload);

    // =====================================
    // USER MANAGEMENT =====================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)

    // Show user management home page
    app.get('/userManagement', isLoggedIn, function (req, res) {
        myStat = "SELECT userrole FROM Users WHERE username = '" + req.user.username + "';";

        connection.query(myStat, function (err, results, fields) {

            if (!results[0].userrole) {
                console.log("Error");
            } else if (results[0].userrole === "Admin" || "Regular") {
                // process the signup form
                res.render('userManagement.ejs', {
                    user: req.user // get the user out of session and pass to template
                });
            }
        });
    });

    // Filter by search criteria
    app.get('/filterUser', isLoggedIn, function (req, res) {
        myStat = "SELECT * FROM Users";

        var myQuery = [
            {
                fieldVal: req.query.dateCreatedFrom,
                dbCol: "dateCreated",
                op: " >= '",
                adj: req.query.dateCreatedFrom
            },
            {
                fieldVal: req.query.dateCreatedTo,
                dbCol: "dateCreated",
                op: " <= '",
                adj: req.query.dateCreatedTo
            },
            {
                fieldVal: req.query.dateModifiedFrom,
                dbCol: "dateModified",
                op: " >= '",
                adj: req.query.dateModifiedFrom
            },
            {
                fieldVal: req.query.dateModifiedTo,
                dbCol: "dateModified",
                op: " <= '",
                adj: req.query.dateModifiedTo
            },
            {
                fieldVal: req.query.firstName,
                dbCol: "firstName",
                op: " = '",
                adj: req.query.firstName
            },
            {
                fieldVal: req.query.lastName,
                dbCol: "lastName",
                op: " = '",
                adj: req.query.lastName
            },
            {
                fieldVal: req.query.userrole,
                dbCol: "userrole",
                op: " = '",
                adj: req.query.userrole
            },
            {
                fieldVal: req.query.status,
                dbCol: "Status",
                op: " = '",
                adj: req.query.status
            }
        ];

        // QueryStat(myQueryObj, myStat, res)

        function userQuery() {
            res.setHeader("Access-Control-Allow-Origin", "*");
            // console.log("Query Statement: " + queryStat);

            connection.query(myStat, function (err, results, fields) {

                var status = [{errStatus: ""}];

                if (err) {
                    console.log(err);
                    status[0].errStatus = "Failed to apply filter.";
                    res.send(status);
                    res.end();
                } else if (results.length === 0) {
                    status[0].errStatus = "No data entries found.";
                    res.send(status);
                    res.end();
                } else {
                    var JSONresult = JSON.stringify(results, null, "\t");
                    console.log(JSONresult);
                    res.send(JSONresult);
                    res.end();
                }
            });
        }

        var j = 0;

        for (var i = 0; i < myQuery.length; i++) {
            // console.log("i = " + i);
            // console.log("field Value: " + !!myQuery[i].fieldVal);
            if (i === myQuery.length - 1) {
                if (!!myQuery[i].fieldVal) {
                    if (j === 0) {
                        myStat += " WHERE " + myQuery[i].dbCol + myQuery[i].op + myQuery[i].fieldVal + "'";
                        j = 1;
                        userQuery()
                    } else {
                        myStat += " AND " + myQuery[i].dbCol + myQuery[i].op + myQuery[i].fieldVal + "'";
                        userQuery()
                    }
                } else {
                    userQuery()
                }
            } else {
                if (!!myQuery[i].fieldVal) {
                    if (j === 0) {
                        myStat += " WHERE " + myQuery[i].dbCol + myQuery[i].op + myQuery[i].fieldVal + "'";
                        j = 1;
                    } else {
                        myStat += " AND " + myQuery[i].dbCol + myQuery[i].op + myQuery[i].fieldVal + "'";
                    }
                }
            }
        }
    });

    // Retrieve user data from user management page
    var edit_User, edit_firstName, edit_lastName, edit_userrole, edit_status;
    app.get('/editUserQuery', isLoggedIn, function(req, res) {

        edit_User = req.query.Username;
        edit_firstName = req.query.First_Name;
        edit_lastName = req.query.Last_Name;
        edit_userrole = req.query.User_Role;
        edit_status = req.query.Status;
        res.json({"error": false, "message": "/editUser"});
    });

    // Show user edit form
    app.get('/editUser', isLoggedIn, function(req, res) {
        res.render('userEdit.ejs', {
            user: req.user, // get the user out of session and pass to template
            userName: edit_User,
            firstName: edit_firstName,
            lastName: edit_lastName,
            userrole: edit_userrole,
            status: edit_status,
            message: req.flash('Data Entry Message')
        });
    });

    app.post('/editUser', isLoggedIn, function(req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header

        if (req.body.newPassword !== "") {
            var updatedUserPass = {
                firstName: req.body.First_Name,
                lastName: req.body.Last_Name,
                userrole: req.body.User_Role,
                status: req.body.Status,
                newPassword: bcrypt.hashSync(req.body.newPassword, null, null)
            };

            myStat = "UPDATE Users SET firstName = ?, lastName = ?, password = ?, userrole = ?, status = ?, modifiedUser = '" + req.user.username + "', dateModified = '" + dateTime + "' WHERE username = ?";
            myVal = [updatedUserPass.firstName, updatedUserPass.lastName, updatedUserPass.newPassword, updatedUserPass.userrole, updatedUserPass.status, edit_User];
            updateDBNres(myStat, myVal, "Update failed!", "/userManagement", res);

        } else {
            var updatedUser = {
                firstName: req.body.First_Name,
                lastName: req.body.Last_Name,
                userrole: req.body.User_Role,
                status: req.body.Status
            };

            myStat = "UPDATE Users SET firstName = ?, lastName = ?, userrole = ?, status = ?, modifiedUser = '" + req.user.username + "', dateModified = '" + dateTime + "'  WHERE username = ?";
            myVal = [updatedUser.firstName, updatedUser.lastName, updatedUser.userrole, updatedUser.status, edit_User];

            updateDBNres(myStat, myVal, "Update failed!", "/userManagement", res);
        }

    });

    app.get('/suspendUser', isLoggedIn, function(req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
        dateNtime();

        var username = req.query.usernameStr.split(",");
        myStat = "UPDATE Users SET modifiedUser = '" + req.user.username + "', dateModified = '" + dateTime + "',  status = 'Suspended'";

        for (var i = 0; i < username.length; i++) {
            if (i === 0) {
                myStat += " WHERE username = '" + username[i] + "'";
                if (i === username.length - 1) {
                    updateDBNres(myStat, "", "Suspension failed!", "/userManagement", res);
                }
            } else {
                myStat += " OR username = '" + username[i] + "'";
                if (i === username.length - 1) {
                    updateDBNres(myStat, "", "Suspension failed!", "/userManagement", res);
                }
            }
        }
    });

    // =====================================
    // TRANSACTION SECTION =================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)

    app.get('/userHome', isLoggedIn, function (req, res) {
        var myStat = "SELECT userrole FROM Users WHERE username = '" + req.user.username + "';";

        connection.query(myStat, function (err, results, fields) {
            //console.log(results);

            if (!results[0].userrole) {
                console.log("Error");
            } else {
                res.render('userHome.ejs', {
                    user: req.user // get the user out of session and pass to template
                });
            }
        });
    });

    app.get('/heatmap', isLoggedIn, function (req, res) {
        res.render('heatmap_Globe.ejs', {
            user: req.user // get the user out of session and pass to template
        });
    });

    app.get('/heatmapData', isLoggedIn, function (req, res) {
        // console.log(req.query);
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header

        var keyword = "General_health";

        var myStat = "SELECT Users.firstName, Users.lastName, General_Form.Latitude, General_Form.Longitude, General_Form.Location_name, " + keyword + ", General_Form.transactionID, General_Form.Date, General_Form.Main_crop, General_Form.Irrigation, General_Form.Crop_stage, General_Form.Farming_system, General_Form.Field_size, General_Form.Field_size_unit, General_Form.Rain_amount FROM Transaction INNER JOIN Users ON Users.username = Transaction.Cr_UN INNER JOIN General_Form ON General_Form.transactionID = Transaction.transactionID INNER JOIN Detailed_Scouting ON Detailed_Scouting.transactionID = Transaction.transactionID";
        // var myStat = "SELECT latitude, longitude, " + keyword + ", _id, date, country, cropMain, cropIrrigation, cropStage, cropSystem, cropFieldSize, cropFieldSizeUnit, rainAmount, totalFAW FROM FAW_PUB.Historical_heatmap_DataTable";
        // var myStat = "SELECT latitude, longitude, temperature FROM FAWv4.testData;";

        if (!!req.query.startDate && !!req.query.endDate) {
            myStat += " WHERE Date >= '" + req.query.startDate + "' AND Date <= '" + req.query.endDate + "'";
        } else if (!req.query.startDate || !req.query.endDate) {
            if (!!req.query.startDate) {
                myStat += " WHERE Date >= '" + req.query.startDate + "'";
            } else if (!!req.query.endDate) {
                myStat += " WHERE Date <= '" + req.query.endDate + "'";
            }
        } else {
            myStat += "";
        }

        // myStat += " WHERE General_Form.transactionID LIKE '2018-07-26%' ORDER BY General_Form.Location_name;";
        // myStat += " WHERE Date >= '2018-08-26' AND Date <= '2018-09-26'";
        myStat += " ORDER BY General_Form.Location_name;";
        connection.query(myStat, function(err, results, fields) {
            // console.log(results);
            if (err) {
                console.log(err);
                res.json({"error": true});
                res.end();
            } else {
                console.log(results.length);
                if (!!config[keyword]) {
                    // console.log(config[keyword]);
                    // console.log(config[keyword]["good"]);
                    // console.log(results);
                    if (results.length === 0) {
                        res.json({"error": false, "data": results});
                    } else {
                        for (var i = 0; i < results.length; i++) {
                            results[i].intensity = config[keyword][results[i][keyword]];

                            if (i === results.length - 1) {
                                // console.log(results);
                                res.json({"error": false, "data": results});
                            }
                        }
                    }
                } else {
                    // console.log("!");
                    res.json({"error": false, "data": results});
                }
            }
        });
    });

    app.get('/heatmapDataP', function (req, res) {
// console.log(req.query);
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header

        var keyword = "General_health";

        var myStat = "SELECT Users.firstName, Users.lastName, General_Form.Latitude, General_Form.Longitude, General_Form.Location_name, " + keyword + ", General_Form.transactionID, General_Form.Date, General_Form.Main_crop, General_Form.Irrigation, General_Form.Crop_stage, General_Form.Farming_system, General_Form.Field_size, General_Form.Field_size_unit, General_Form.Rain_amount FROM Transaction INNER JOIN Users ON Users.username = Transaction.Cr_UN INNER JOIN General_Form ON General_Form.transactionID = Transaction.transactionID INNER JOIN Detailed_Scouting ON Detailed_Scouting.transactionID = Transaction.transactionID";
        // var myStat = "SELECT latitude, longitude, " + keyword + ", _id, date, country, cropMain, cropIrrigation, cropStage, cropSystem, cropFieldSize, cropFieldSizeUnit, rainAmount, totalFAW FROM FAW_PUB.Historical_heatmap_DataTable";
        // var myStat = "SELECT latitude, longitude, temperature FROM FAWv4.testData;";

        if (!!req.query.startDate && !!req.query.endDate) {
            myStat += " WHERE Date >= '" + req.query.startDate + "' AND Date <= '" + req.query.endDate + "'";
        } else if (!req.query.startDate || !req.query.endDate) {
            if (!!req.query.startDate) {
                myStat += " WHERE Date >= '" + req.query.startDate + "'";
            } else if (!!req.query.endDate) {
                myStat += " WHERE Date <= '" + req.query.endDate + "'";
            }
        } else {
            myStat += "";
        }

        // myStat += " WHERE General_Form.transactionID LIKE '2018-07-26%' ORDER BY General_Form.Location_name;";
        // myStat += " WHERE Date >= '2018-08-26' AND Date <= '2018-09-26'";
        myStat += " ORDER BY General_Form.Location_name;";
        connection.query(myStat, function(err, results, fields) {
            console.log(results);
            if (err) {
                console.log(err);
                res.json({"error": true});
                res.end();
            } else {
                console.log("a");
                if (!!config[keyword]) {
                    // console.log(config[keyword]);
                    // console.log(config[keyword]["good"]);
                    // console.log(results);
                    if (results.length === 0) {
                        res.json({"error": false, "data": results});
                    } else {
                        for (var i = 0; i < results.length; i++) {
                            results[i].intensity = config[keyword][results[i][keyword]];

                            if (i === results.length - 1) {
                                console.log(results);
                                res.json({"error": false, "data": results});
                            }
                        }
                    }
                } else {
                    // console.log("!");
                    res.json({"error": false, "data": results});
                }
            }
        });
    });

    app.get('/deleteRow2', isLoggedIn, function(req, res) {
        del_recov("Deleted", "Deletion failed!", "/dataHistory", req, res);
    });

    app.get('/recoverRow2', isLoggedIn, function(req, res){
        del_recov("Active", "Recovery failed!", "/dataHistory", req, res);
    });

    app.get('/deleteRow', isLoggedIn, function(req, res) {
        del_recov("Deleted", "Deletion failed!", "/userHome", req, res);
    });

    app.get('/recoverRow', isLoggedIn, function(req, res){
        del_recov("Active", "Recovery failed!", "/userHome", req, res);
    });

    // edit on homepage
    var editTransactionID;
    var editData;
    var fieldData;
    var locDataQ;
    var fieldIDStr;
    var editFieldData;
    app.get('/sendEditData', isLoggedIn, function(req, res) {
        editTransactionID = req.query.transactionIDStr;
        var scoutingStat = "SELECT Users.firstName, Users.lastName, General_Form.*, Detailed_Scouting.* FROM Transaction INNER JOIN Users ON Users.username = Transaction.Cr_UN INNER JOIN General_Form ON General_Form.transactionID = Transaction.transactionID INNER JOIN Detailed_Scouting ON Detailed_Scouting.transactionID = Transaction.transactionID WHERE Transaction.transactionID = '" + editTransactionID +"';";
        var trapStat = "SELECT Users.firstName, Users.lastName, General_Form.*, Detailed_Trap.* FROM Transaction INNER JOIN Users ON Users.username = Transaction.Cr_UN INNER JOIN General_Form ON General_Form.transactionID = Transaction.transactionID INNER JOIN Detailed_Trap ON Detailed_Trap.transactionID = Transaction.transactionID WHERE Transaction.transactionID = '" + editTransactionID + "';";
        var fieldStat = "SELECT Field.* FROM General_Form INNER JOIN Field ON Field.fieldId = General_Form.fieldId WHERE Transaction.transactionID = '" + editTransactionID + "';";

        connection.query(scoutingStat + trapStat, function (err, results, fields) {

            if (err) {
                console.log(err);
                res.json({"error": true, "message": "Failed to save edit."});
            } else {
                console.log(results);
                /*connection.query(fieldStat, function (err, resultsD, fields) {
                    if (err) {
                        console.log(err);
                        res.json({"error": true, "message": "Failed to save edit."});
                    } else {
                        console.log(resultsD);
                        if (results.length === 0) {
                            res.json({"error": true, "message": "fail"});
                        } else {
                            res.json({"error": false, "FieldData": resultsD[0]});
                        }
                    }
                });*/
                if (results[0].length > 0) {
                    editData = results[0][0];
                    res.json({"error": false, "message": "/editData"});
                } else if (results[1].length > 0) {
                    editData = results[1][0];
                    res.json({"error": false, "message": "/editData"});
                } else {
                    res.json({"error": true, "message": "Failed to edit."});
                }
            }
        });
        /*connection.query(fieldStat, function (err, results, fields) {

            if (err) {
                console.log(err);
                res.json({"error": true, "message": "Failed to save edit."});
            } else {
                console.log(results);
                if (results[0].length > 0) {
                    fieldData = results[0][0];
                    res.json({"error": false, "message": "/editData"});
                } else if (results[1].length > 0) {
                    fieldData = results[1][0];
                    res.json({"error": false, "message": "/editData"});
                } else {
                    res.json({"error": true, "message": "Failed to edit."});
                }
            }
        });*/
    });
    app.get('/sendFieldData', isLoggedIn, function(req, res) {
        locDataQ = req.query.locationName;
        console.log(locDataQ);

        var fieldStat = "SELECT * FROM Field WHERE status = 'Active' AND username = '" + req.user.username + "' AND locationName = '" + locDataQ + "';";

        connection.query(fieldStat, function (err, results, fields) {

            if (err) {
                console.log(err);
                res.json({"error": true, "message": "Failed to save edit."});
            } else {
                console.log(results);
                if (results.length === 0) {
                    res.json({"error": true, "message": "fail"});
                } else {
                    res.json({"error": false, "data": results[0]});
                }
            }
        });
    });
    app.get('/sendFieldDataP', isLoggedIn, function(req, res) {
        fieldIDStr = req.query.fieldId;
        console.log(locDataQ);

        var fieldStat = "SELECT * FROM Field WHERE status = 'Active' AND username = '" + req.user.username + "' AND fieldId = '" + fieldIDStr + "';";

        connection.query(fieldStat, function (err, results, fields) {

            if (err) {
                console.log(err);
                res.json({"error": true, "message": "Failed to save edit."});
            } else {
                console.log(results);
                if (results.length === 0) {
                    res.json({"error": true, "message": "fail"});
                } else {
                    editFieldData = results[0];
                    res.json({"error": false, "message": "/editFieldData"});
                }
            }
        });
    });
    app.get('/edit', isLoggedIn, function (req, res) {
        // res.render("test.ejs");
        // console.log("11");
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header

        var myStat = "SELECT Damage_photo, Damage_photo_name FROM Detailed_Scouting WHERE transactionID = '" + editTransactionID +"';";
        console.log("This is for editing photos ONLY >:( " + editTransactionID);

        var filePath0;
        connection.query(myStat, function (err, results) {
            console.log("query statement : " + myStat);

            if (!results[0].Damage_photo && !results[0].Damage_photo_name) {
                console.log("Error");
            } else {
                filePath0 = results[0];
                var JSONresult = JSON.stringify(results, null, "\t");
                console.log(JSONresult);
                res.send(JSONresult);
                res.end()
            }
        });
    });
    app.get('/edit2', isLoggedIn, function (req, res) {
        // res.render("test.ejs");
        // console.log("11");
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header

        var myStat = "SELECT Pest_photo, Pest_photo_name FROM Detailed_Scouting WHERE transactionID = '" + editTransactionID +"';";
        console.log("This is for editing photos ONLY >:( " + editTransactionID);

        var filePath0;
        connection.query(myStat, function (err, results) {
            console.log("query statement : " + myStat);

            if (!results[0].Pest_photo && !results[0].Pest_photo_name) {
                console.log("Error");
            } else {
                filePath0 = results[0];
                var JSONresult = JSON.stringify(results, null, "\t");
                console.log(JSONresult);
                res.send(JSONresult);
                res.end()
            }
        });
    });
    app.delete("/deleteFiles/:uuid", onDeleteFile);

    app.get('/editData', isLoggedIn, function(req, res) {
        // console.log(editData.transactionID);
        res.render('dataEdit.ejs', {
            user: req.user,
            fieldData: fieldData,
            data: editData, // get the user out of session and pass to template
            message: req.flash('Data Entry Message')
        });
    });
    app.get('/editFieldData', isLoggedIn, function(req, res) {
        // console.log(editData.transactionID);
        console.log(editFieldData);
        console.log("adfsdfasdf");
        res.render('formP_edit.ejs', {
            user: req.user,
            firstname: req.user.firstName,
            lastname: req.user.lastName,
            datafield: editFieldData, // get the user out of session and pass to template
            message: req.flash('Data Entry Message')
        });
    });

    app.get('/recovery', isLoggedIn, function (req, res) {
        // render the page and pass in any flash data if it exists
        res.render('recovery.ejs', {
            user: req.user,
            message: req.flash('restoreMessage')
        });
    });

    app.get('/recovery2', isLoggedIn, function (req, res) {
        // render the page and pass in any flash data if it exists
        res.render('recovery_dataHistory.ejs', {
            user: req.user,
            message: req.flash('restoreMessage')
        });
    });

    // show the data history ejs
    app.get('/dataHistory', isLoggedIn, function (req, res) {
        res.render('dataHistory.ejs', {
            user: req.user // get the user out of session and pass to template
        });
    });

    app.get('/filterQuery', isLoggedIn, function (req, res) {
        // var scoutingStat = "SELECT Users.username, Users.firstName, Users.lastName, General_Form.*, Detailed_Scouting.* FROM Transaction INNER JOIN Users ON Users.username = Transaction.Cr_UN INNER JOIN General_Form ON General_Form.transactionID = Transaction.transactionID INNER JOIN Detailed_Scouting ON Detailed_Scouting.transactionID = Transaction.transactionID";
        // var trapStat = "SELECT Users.username, Users.firstName, Users.lastName, General_Form.*, Detailed_Trap.* FROM Transaction INNER JOIN Users ON Users.username = Transaction.Cr_UN INNER JOIN General_Form ON General_Form.transactionID = Transaction.transactionID INNER JOIN Detailed_Trap ON Detailed_Trap.transactionID = Transaction.transactionID";

        var scoutingStat = "SELECT Users.username, Users.firstName, Users.lastName, General_Form.*, Detailed_Scouting.*, Field.* FROM Transaction INNER JOIN Users ON Users.username = Transaction.Cr_UN INNER JOIN General_Form ON General_Form.transactionID = Transaction.transactionID INNER JOIN Detailed_Scouting ON Detailed_Scouting.transactionID = Transaction.transactionID INNER JOIN Field ON Field.fieldId = General_Form.fieldId";
        var trapStat = "SELECT Users.username, Users.firstName, Users.lastName, General_Form.*, Detailed_Trap.*, Field.*  FROM Transaction INNER JOIN Users ON Users.username = Transaction.Cr_UN INNER JOIN General_Form ON General_Form.transactionID = Transaction.transactionID INNER JOIN Detailed_Trap ON Detailed_Trap.transactionID = Transaction.transactionID INNER JOIN Field ON Field.fieldId = General_Form.fieldId";
        //console.log(req.query);
        var myQueryObj = [
            {
                fieldVal: req.query.statusDel,
                dbCol: "General_Form.Status_del",
                op: " = '",
                adj: req.query.statusDel,
                table: 1
            },
            {
                fieldVal: req.query.statusDel,
                dbCol: "Detailed_Scouting.Status_del",
                op: " = '",
                adj: req.query.statusDel,
                table: 2
            },
            {
                fieldVal: req.query.statusDel,
                dbCol: "Detailed_Trap.Status_del",
                op: " = '",
                adj: req.query.statusDel,
                table: 3
            },
            {
                fieldVal: req.query.firstName,
                dbCol: "firstName",
                op: " = '",
                adj: req.query.firstName,
                table: 1
            },
            {
                fieldVal: req.query.lastName,
                dbCol: "lastName",
                op: " = '",
                adj: req.query.lastName,
                table: 1
            },
            {
                fieldVal: req.query.startDate,
                dbCol: "date",
                op: " >= '",
                adj: req.query.startDate,
                table: 1
            },
            {
                fieldVal: req.query.endDate,
                dbCol: "date",
                op: " <= '",
                adj: req.query.endDate,
                table: 1
            },
            {
                fieldVal: req.query.content1,
                dbCol: req.query.filter1,
                op: " = '",
                adj: req.query.filter1,
                table: req.query.filter1
            },
            {
                fieldVal: req.query.content2,
                dbCol: req.query.filter2,
                op: " = '",
                adj: req.query.filter2,
                table: req.query.filter2
            },
            {
                fieldVal: req.query.content3,
                dbCol: req.query.filter3,
                op: " = '",
                adj: req.query.filter3,
                table: req.query.filter3
            }
        ];
        QueryStat(myQueryObj, scoutingStat, trapStat, res)
    });

    // Prepare and assign new transaction ID
    app.get('/newEntry', isLoggedIn, function (req, res) {
        var d = new Date();
        var utcDateTime = d.getUTCFullYear() + "-" + ('0' + (d.getUTCMonth() + 1)).slice(-2) + "-" + ('0' + d.getUTCDate()).slice(-2);
        var queryTransID = "SELECT COUNT(transactionID) AS number FROM Transaction WHERE transactionID LIKE '" + utcDateTime + "%';";

        connection.query(queryTransID, function (err, results, fields) {
            transactionID = utcDateTime + "_" + ('0000' + (results[0].number + 1)).slice(-5);
            if (err) {
                console.log(err);
            } else {
                var insertTransID = "INSERT INTO Transaction (transactionID, Cr_UN) VALUE (" + "'" + transactionID + "', '" + req.user.username + "');";
                connection.query(insertTransID, function (err, results, fields) {
                    if (err) {
                        console.log(err);
                    } else {
                        // Show general form
                        res.render('form.ejs', {
                            user: req.user, // get the user out of session and pass to template
                            message: req.flash('Data Entry Message'),
                            firstname: req.user.firstName,
                            lastname: req.user.lastName,
                            transactionID: transactionID
                        });
                    }
                });
            }
        });
    });

    // // Upload photos
    // app.post('/upload', fileUpload, function (req,res) {
    //     //console.log(req.headers.origin);
    //     res.setHeader("Access-Control-Allow-Origin", "*");
    //
    //     fileUpload(req, res, function (err) {
    //         if (err) {
    //             console.log(err);
    //             res.json({"error": true, "message": "Fail"});
    //             filePathName = "";
    //             //res.send("Error uploading file.");
    //         } else {
    //             console.log("Success:" + filePathName);
    //             filePath = filePathName;
    //             if (!!filePathName){
    //                 // filePath = editData.Photo_of_Pest + ";" + editData.Photo_of_Damage;
    //                 res.json({"error": false, "message": filePathName});
    //                 filePathName = "";
    //             } else {
    //                 var error = false;
    //                 filePath = editData.Photo_of_Pest + ";" + editData.Photo_of_Damage;
    //                 var files = (editData.Photo_of_Pest + ";" + editData.Photo_of_Damage).split(";");
    //                 for (var i = 0; i < files.length; i++) {
    //                     fs.unlink(files[i],function(err){
    //                         if(err) {
    //                             error = true;
    //                             res.json({"error": true, "message": "Upload Fail !"});
    //                             filePathName = "";
    //                         }
    //                     });
    //
    //                     if (i === files.length - 1 && error === false) {
    //                         res.json({"error": false, "message": filePathName});
    //                         filePathName = "";
    //                     }
    //                 }
    //             }
    //             // res.json({"error": false, "message": filePathName});
    //             // filePathName = "";
    //             //res.send("File is uploaded");
    //         }
    //     });
    // });

    // Upload photos
    app.post('/upload', onUpload);
// , function (req,res) {
//     //console.log(req.headers.origin);
//     res.setHeader("Access-Control-Allow-Origin", "*");
//
//     fileUpload(req, res, function (err) {
//         if (err) {
//             console.log(err);
//             res.json({"error": true, "message": "Fail"});
//             filePathName = "";
//             //res.send("Error uploading file.");
//         } else {
//             console.log("Success:" + filePathName);
//             filePath = filePathName;
//             res.json({"error": false, "message": filePathName});
//             filePathName = "";
//         }
//     });
//     app.post("/submit", isLoggedIn, function (req, res) {
//         res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
//
//         var newImage = {
//             Damage_photo: "https://aworldbridgelabs.com/uploadfiles/" + responseDataUuid,
//             Damage_photo_name: responseDataUuid
//         };
//         console.log("path: " + responseDataUuid);
//         console.log("names: " + responseDataUuid);
//
//
//         var myStat = "INSERT INTO Detailed_Scouting (Damage_photo, Damage_photo_name) VALUES (?,?)";
//         var myVal = [newImage.Damage_photo, newImage.Damage_photo_name];
//         console.log("query statement : " + myStat);
//         console.log("values: " + myVal);
//
//         connection.query(myStat, myVal, function (err, results) {
//             if (err) {
//                 console.log("query statement T^T: " + myStat);
//                 console.log("values T^T: " + myVal);
//                 console.log(err);
//                 res.send("Unfortunately, there has been an error!");
//                 res.end();
//             } else {
//                 console.log("query statement yay: " + myStat);
//                 console.log("values yay: " + myVal);
//                 console.log("All a big success!");
//                 res.send("All a big success!");
//                 res.end();
//             }
//
//         });
//     });

    // Submit general form
    app.post('/generalForm', isLoggedIn, function (req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        //console.log(req.body);

        var result = Object.keys(req.body).map(function (key) {
            return [String(key), req.body[key]];
        });

        var name = "";
        var value = "";

        for (var i = 0; i < result.length; i++) {
            if (result[i][0] === "Field_size_integer") {
                // field size
                name += result[i][0].substring(0, result[i][0].length - 8) + ", ";
                // one decimal place = divide by 10
                value += '"' + (parseFloat(result[i][1]) + (result[i + 1][1] / 10)) + '"' + ", ";
                i = i + 1;
            } else {
                // normal
                if (result[i][1] !== "") {
                    name += result[i][0] + ", ";
                    value += '"' + result[i][1] + '"' + ", ";
                }
            }
        }
        name = name.substring(0, name.length - 2);
        value = value.substring(0, value.length - 2);

        // console.log(name);
        // console.log(value);
        var deleteStatement = "DELETE FROM General_Form WHERE transactionID = '" + req.body.transactionID + "'; ";
        var insertStatement = "INSERT INTO General_Form (" + name + ") VALUES (" + value + ");";
        console.log(insertStatement);

        connection.query(deleteStatement + insertStatement, function (err, results, fields) {
            if (err) {
                console.log(err);
                res.json({"error": true, "message": "Insert Error! Check your entry."});
            } else {
                res.json({"error": false, "message": "/detailedForm"});
            }
        });
    });

    // Submit detailed form Scouting
    app.post('/detailedFormScouting', isLoggedIn, function (req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        console.log(req.body);
        var result = Object.keys(req.body).map(function (key) {
            return [String(key), req.body[key]];
        });

        var name = "";
        var value = "";

        for (var i = 0; i < result.length; i++) {
            if (result[i][0] === "Pest_stage" || result[i][0] === "Control_undertaken") {
                name += result[i][0] + ", ";
                var str = result[i][1].toString();
                str = str.replace(/,/g, "/");
                value += '"' + str + '"' + ", ";
            } else {
                name += result[i][0] + ", ";
                value += '"' + result[i][1] + '"' + ", ";
            }
        }
        name = name.substring(0, name.length - 2);
        value = value.substring(0, value.length - 2);

        // var path = responseDataUuid.split(";");
        // //console.log(path);
        // var damage = "";
        // var damage_name = "";
        // var pest = "";
        //
        // for (var i = 0; i < path.length - 1; i++) {
        //     console.log("New paths underway!!!!");
        //     if (path[i] === "Damage_photo") {
        //         damage += "https://aworldbridgelabs.com/uploadfiles/" + path[i] + ";";
        //     } else if (path[i] === "Damage_photo_name") {
        //         damage_name += path[i] + ";";
        //     // } else if (path[i].substring(0,10) === "Pest_photo") {
        //     //     pest += "https://aworldbridgelabs.com/uploadfiles/" + path[i] + ";";
        //     }
        // }
        // //console.log(pest + "  " + damage);
        // damage = damage.substring(0, damage.length - 1);
        // damage_name = damage_name.substring(0, damage_name.length - 1);
        // // pest = pest.substring(0, pest.length - 1);
        //
        // name += ", Damage_photo, Damage_photo_name";
        // value += ", '" + damage + "', '" + damage_name + "'";

        var newImage = {
            Damage_photo: uploadPath + responseDataUuid,
            Damage_photo_name: responseDataUuid,
            Pest_photo: uploadPath + responseDataUuid2,
            Pest_photo_name: responseDataUuid2
        };

        console.log("path: " + responseDataUuid + "pest: " + responseDataUuid2);
        console.log("names: " + responseDataUuid + "pest: " + responseDataUuid2);

        name += ", Damage_photo, Damage_photo_name, Pest_photo, Pest_photo_name";
        value += ", '" + newImage.Damage_photo + "', '" + newImage.Damage_photo_name + "', '" + newImage.Pest_photo + "', '" + newImage.Pest_photo_name + "'";

        var deleteStatement = "DELETE FROM Detailed_Scouting WHERE transactionID = '" + req.body.transactionID + "'; ";
        var insertStatement = "INSERT INTO Detailed_Scouting (" + name + ") VALUES (" + value + ");";
        console.log(insertStatement);

        connection.query(deleteStatement + insertStatement, function (err, results, fields) {
            if (err) {
                console.log(err);
                res.json({"error": true, "message": "Insert Error! Check your entry."});
            } else {
                res.json({"error": false, "message": "/detailedForm"});
            }
        });
    });

    // Submit detailed form trap
    app.post('/detailedFormTrap', isLoggedIn, function (req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        console.log(req.body);
        var result = Object.keys(req.body).map(function (key) {
            return [String(key), req.body[key]];
        });

        var name = "";
        var value = "";

        for (var i = 0; i < result.length; i++) {
            name += result[i][0] + ", ";
            value += '"' + result[i][1] + '"' + ", ";
        }
        name = name.substring(0, name.length - 2);
        value = value.substring(0, value.length - 2);

        // var path = filePath.split(";");
        // console.log(path);
        // var damage = "";
        // var pest = "";
        //
        // for (var i = 0; i < path.length - 1; i++) {
        //     console.log("A");
        //     if (path[i].substring(0,12) === "Damage_photo") {
        //         damage += "https://aworldbridgelabs.com/uploadfiles/" + path[i] + ";";
        //     } else if (path[i].substring(0,10) === "Pest_photo") {
        //         pest += "https://aworldbridgelabs.com/uploadfiles/" + path[i] + ";";
        //     }
        // }
        // console.log(pest + "  " + damage);
        // damage = damage.substring(0, damage.length - 1);
        // pest = pest.substring(0, pest.length - 1);
        //
        // name += ", Damage_photo, Pest_photo";
        // value += ", '" + damage + "', '" + pest + "'";

        var deleteStatement = "DELETE FROM Detailed_Trap WHERE transactionID = '" + req.body.transactionID + "'; ";
        var insertStatement = "INSERT INTO Detailed_Trap (" + name + ") VALUES (" + value + ");";
        console.log(insertStatement);

        connection.query(deleteStatement + insertStatement, function (err, results, fields) {
            if (err) {
                console.log(err);
                res.json({"error": true, "message": "Insert Error! Check your entry."});
            } else {
                res.json({"error": false, "message": "/detailedForm"});
            }
        });
    });

    app.post('/formPP', isLoggedIn, function (req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        //console.log(req.body);

        var result = Object.keys(req.body).map(function (key) {
            return [String(key), req.body[key]];
        });

        var name = "";
        var value = "";
        var locationId = "";

        for (var i = 0; i < result.length; i++) {
            if (result[i][0] === "locationName") {
                name += result[i][0] + ", ";
                var string = result[i][1].toString();
                string = string.replace(/ /g, "_");
                value += '"' + string + '"' + ", ";
                locationId = string + '"';
                console.log(string);
                console.log(locationId);
            } else if (result[i][0] === "fieldId") {
                name += result[i][0] + ", ";
                value += '"' + result[i][1] + locationId + ", ";
                console.log("fieldId: " + locationId);
            } else if (result[i][0] === "Field_size_integer") {
                // field size
                name += "fieldSize" + ", ";
                // one decimal place = divide by 10
                value += '"' + (parseFloat(result[i][1]) + (result[i + 1][1] / 10)) + '"' + ", ";
                i = i + 1;
            } else if (result[i][0] === "rotationIntercropping") {
                name += "rotationIntercropping" + ", ";
                var str = result[i][1].toString();
                str = str.replace(/,/g, "/");
                value += '"' + str + '"' + ", ";
            } else {
                // normal
                if (result[i][1] !== "") {
                    name += result[i][0] + ", ";
                    value += '"' + result[i][1] + '"' + ", ";
                }
            }
        }
        name = name.substring(0, name.length - 2);
        value = value.substring(0, value.length - 2);

        // console.log(name);
        // console.log(value);
        var deleteStatement = "DELETE FROM Field WHERE id = '" + req.body.id + "'; ";
        var insertStatement = "INSERT INTO Field (" + name + ") VALUES (" + value + ");";
        console.log(insertStatement);

        connection.query(deleteStatement + insertStatement, function (err, results, fields) {
            if (err) {
                console.log(err);
                res.json({"error": true, "message": "Insert Error! Check your entry."});
            } else {
                res.json({"error": false, "message": "/userProfile"});
            }
        });
    });

    app.post('/formP_edit', isLoggedIn, function (req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        //console.log(req.body);

        var result = Object.keys(req.body).map(function (key) {
            return [String(key), req.body[key]];
        });

        var name = "";
        var value = "";
        var locationId = "";

        for (var i = 0; i < result.length; i++) {
            if (result[i][0] === "locationName") {
                name += result[i][0] + ", ";
                var string = result[i][1].toString();
                string = string.replace(/ /g, "_");
                value += '"' + string + '"' + ", ";
                locationId = string;
                console.log(string);
                console.log(locationId);
            } else if (result[i][0] === "fieldId") {
                name += result[i][0] + ", ";
                value += '"' + result[i][1] + locationId + '"' + ", ";
                console.log("fieldId: " + locationId);
            } else if (result[i][0] === "Field_size_integer") {
                // field size
                name += "fieldSize" + ", ";
                // one decimal place = divide by 10
                value += '"' + (parseFloat(result[i][1]) + (result[i + 1][1] / 10)) + '"' + ", ";
                i = i + 1;
            } else if (result[i][0] === "rotationIntercropping") {
                name += "rotationIntercropping" + ", ";
                var str = result[i][1].toString();
                str = str.replace(/,/g, "/");
                value += '"' + str + '"' + ", ";
            } else {
                // normal
                if (result[i][1] !== "") {
                    name += result[i][0] + ", ";
                    value += '"' + result[i][1] + '"' + ", ";
                }
            }
        }
        name = name.substring(0, name.length - 2);
        value = value.substring(0, value.length - 2);

        // console.log(name);
        // console.log(value);
        var deleteStatement = "DELETE FROM Field WHERE id = '" + req.body.id + "'; ";
        var insertStatement = "INSERT INTO Field (" + name + ") VALUES (" + value + ");";
        console.log(insertStatement);

        connection.query(deleteStatement + insertStatement, function (err, results, fields) {
            if (err) {
                console.log(err);
                res.json({"error": true, "message": "Insert Error! Check your entry."});
            } else {
                res.json({"error": false, "message": "/userField"});
            }
        });
    });


    // =====================================
    // SIGNOUT =============================
    // =====================================
    //shouw the signout form
    app.get('/signout', function (req, res) {
        req.session.destroy();
        req.logout();
        res.redirect('/login');
    });
    app.get('/scanner',function (req,res) {
        res.render('scanner.ejs')
    });

    app.get('Cancel', function (req, res) {
        res.redirect('/userHome');
        res.render('userHome', {
            user: req.user // get the user out of session and pass to template
        });
    });

};

// route middleware to make sure
function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/');
}

function dateNtime() {
    today = new Date();
    date2 = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    time2 = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    dateTime = date2 + ' ' + time2;
}

function tokenExpTime() {
    today = new Date();
    date3 = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + (today.getDate()+1);
    time3 = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    tokenExpire = date3 + ' ' + time3;
}

function del_recov(StatusUpd, ErrMsg, targetURL, req, res) {

    transactionID = req.query.transactionIDStr.split(",");
    console.log(transactionID);
    var statementGeneral = "UPDATE General_Form SET Status_del = '" + StatusUpd + "'";
    var statementDetailedS = "UPDATE Detailed_Scouting SET Status_del = '" + StatusUpd + "'";
    var statementDetailedT = "UPDATE Detailed_Trap SET Status_del = '" + StatusUpd + "'";

    for (var i = 0; i < transactionID.length; i++) {
        if (i === 0) {
            statementGeneral += " WHERE transactionID = '" + transactionID[i] + "'";
            statementDetailedS += " WHERE transactionID = '" + transactionID[i] + "'";
            statementDetailedT += " WHERE transactionID = '" + transactionID[i] + "'";

            if (i === transactionID.length - 1) {
                statementGeneral += ";";
                statementDetailedS += ";";
                statementDetailedT += ";";
                myStat = statementGeneral + statementDetailedS + statementDetailedT;
                updateDBNres(myStat, "", ErrMsg, targetURL, res);
            }
        } else {
            statementGeneral += " OR transactionID = '" + transactionID[i] + "'";
            statementDetailedS += " OR transactionID = '" + transactionID[i] + "'";
            statementDetailedT += " OR transactionID = '" + transactionID[i] + "'";

            if (i === transactionID.length - 1) {
                statementGeneral += ";";
                statementDetailedS += ";";
                statementDetailedT += ";";
                myStat = statementGeneral + statementDetailedS + statementDetailedT;
                updateDBNres(myStat, "", ErrMsg, targetURL, res);
            }
        }
    }
}

function updateDBNres(SQLstatement, Value, ErrMsg, targetURL, res) {
    res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
    //console.log("Query Statement: " + SQLstatement);

    connection.query(SQLstatement, Value, function (err, rows) {
        if (err) {
            console.log(err);
            res.json({"error": true, "message": ErrMsg});
        } else { res.json({"error": false, "message": targetURL});}
    })
}

function updateDBNredir(SQLstatement, Value, ErrMsg, failURL, redirURL, res) {
    res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
    //console.log("Query Statement: " + SQLstatement);

    connection.query(SQLstatement, Value, function (err, rows) {
        if (err) {
            console.log(err);
            res.render(failURL, {message: req.flash(ErrMsg)});
        } else {
            res.redirect(redirURL);
            // render the page and pass in any flash data if it exists
        }
    })
}

function QueryStat(myObj, scoutingStat, trapStat, res) {
    var j = 0;
    for (var i = 0; i < myObj.length; i++) {
        //console.log("i = " + i);
        //console.log("field Value: " + !!myObj[i].fieldVal);
        if (!!myObj[i].adj){
            if (i === 7 || i === 8 || i === 9) {
                myObj[i].dbCol = myObj[i].dbCol.substring(1, myObj[i].dbCol.length);
                myObj[i].table = parseInt(myObj[i].table.substring(0, 1));
            }

            var aw;
            if (j === 0) {
                aw = " WHERE ";
                j = 1;
            } else {
                aw = " AND ";
            }

            if (myObj[i].table === 1) {
                scoutingStat = editStat(scoutingStat, aw, myObj[i].dbCol, myObj[i].op, myObj[i].fieldVal);
                trapStat = editStat(trapStat, aw, myObj[i].dbCol, myObj[i].op, myObj[i].fieldVal);
            } else if (myObj[i].table === 2) {
                scoutingStat = editStat(scoutingStat, aw, myObj[i].dbCol, myObj[i].op, myObj[i].fieldVal);
            } else if (myObj[i].table === 3) {
                trapStat = editStat(trapStat, aw, myObj[i].dbCol, myObj[i].op, myObj[i].fieldVal);
            }

            if (i === myObj.length - 1) {
                var sqlStatement = scoutingStat + "; " + trapStat;
                dataList(sqlStatement, res);
            }
        } else {
            if (i === myObj.length - 1) {
                var sqlStatement = scoutingStat + "; " + trapStat;
                dataList(sqlStatement, res);
            }
        }

        // if (!!myObj[i].adj) {
        //     if (j === 0) {
        //         j = 1;
        //         if (i === myObj.length - 1) {
        //             if (!!myObj[i].fieldVal) {
        //                 myNewStat += " WHERE " + myObj[i].dbCol + myObj[i].op + myObj[i].fieldVal + "'";
        //                 dataList(myNewStat,res)
        //             } else {
        //                 // myNewStat += " WHERE " + myObj[i].dbCol + " IS NULL";
        //                 dataList(myNewStat,res)
        //             }
        //         } else {
        //             if (!!myObj[i].fieldVal) {
        //                 myNewStat += " WHERE " + myObj[i].dbCol + myObj[i].op + myObj[i].fieldVal + "'";
        //             } else {
        //                 // myNewStat += " WHERE " + myObj[i].dbCol + " IS NULL";
        //             }
        //         }
        //     } else {
        //         if (i === myObj.length - 1) {
        //             if (!!myObj[i].fieldVal) {
        //                 myNewStat += " AND " + myObj[i].dbCol + myObj[i].op + myObj[i].fieldVal + "'";
        //                 dataList(myNewStat,res)
        //             } else {
        //                 // myNewStat += " AND " + myObj[i].dbCol + " IS NULL";
        //                 dataList(myNewStat,res)
        //             }
        //         } else {
        //             if (!!myObj[i].fieldVal) {
        //                 myNewStat += " AND " + myObj[i].dbCol + myObj[i].op + myObj[i].fieldVal + "'";
        //             } else {
        //                 // myNewStat += " AND " + myObj[i].dbCol + " IS NULL";
        //             }
        //         }
        //     }
        // } else {
        //     if (i === myObj.length - 1) {
        //         dataList(myNewStat,res)
        //     }
        // }
    }

    function editStat(stat, aw, dbCol, op, fieldVal) {
        stat += aw + dbCol + op + fieldVal + "'";
        return stat;
    }
}

function dataList(sqlStatement, res) {
    console.log(sqlStatement);

    res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
    connection.query(sqlStatement, function (err, results, fields) {

        errStatus = [{errMsg: ""}];

        if (err) {
            console.log(err);
            errStatus[0].errMsg = "Failed to apply filter.";
            res.send(errStatus);
            res.end();
        } else if (results[0].length === 0 && results[1].length === 0) {
            errStatus[0].errMsg = "No data entries found.";
            res.send(errStatus);
            res.end();
        } else {
            var result = results[0].concat(results[1]);
            var JSONresult = JSON.stringify(result, null, "\t");
            console.log(JSONresult);
            res.send(JSONresult);
            res.end();
        }
    });
}

function changeMail(str) {
    var spliti = str.split("@");
    var letter1 = spliti[0].substring(0, 1);
    var letter2 = spliti[0].substring(spliti[0].length - 1, spliti[0].length);
    var newFirst = letter1;
    for(i = 0; i < spliti[0].length - 2; i++) {
        newFirst += "*";
    }
    newFirst += letter2;

    var letter3 = spliti[1].substring(0, 1);
    var extension = letter3;
    for(i = 0; i < spliti[1].split(".")[0].length - 1; i++) {
        extension += "*";
    }
    extension += "." + spliti[1].split(".")[1];
    var result = newFirst + "@" + extension;

    return result;
}
function onUpload(req, res, next) {
    var form = new multiparty.Form();

    form.parse(req, function(err, fields, files) {
        console.log(fields);
        console.log("A");
        var partIndex = fields.qqpartindex;

        // text/plain is required to ensure support for IE9 and older
        res.set("Content-Type", "text/plain");

        if (partIndex == null) {
            onSimpleUpload(fields, files[fileInputName][0], res);
        }
        else {
            onChunkedUpload(fields, files[fileInputName][0], res);
        }
    });
    console.log("the other: " + responseDataUuid);

    // return next();
}

var responseDataUuid = "",
    responseDataName = "",
    responseDataUuid2 = "",
    responseDataName2 = "";
function onSimpleUpload(fields, file, res) {
    var d = new Date(),
        uuid = d.getUTCFullYear() + "-" + ('0' + (d.getUTCMonth() + 1)).slice(-2) + "-" + ('0' + d.getUTCDate()).slice(-2) + "T" + ('0' + d.getUTCHours()).slice(-2) + ":" + ('0' + d.getUTCMinutes()).slice(-2) + ":" + ('0' + d.getUTCSeconds()).slice(-2) + "Z",
        responseData = {
            success: false,
            newuuid: uuid + "_" + fields.qqfilename,
            newuuid2: uuid + "_" + fields.qqfilename
        };

    responseDataUuid = responseData.newuuid;
    responseDataUuid2 = responseData.newuuid2;

    file.name = fields.qqfilename;
    responseDataName = file.name;
    responseDataName2 = file.name;

    console.log("forth hokage: " + responseDataUuid);
    console.log("fifth harmony: " + responseDataName);
    console.log("trials 4 days: " + responseDataUuid2);
    console.log("pentatonic success: " + responseDataName2);

    if (isValid(file.size)) {
        moveUploadedFile(file, uuid, function() {
                responseData.success = true;
                res.send(responseData);
            },
            function() {
                responseData.error = "Problem copying the file!";
                res.send(responseData);
            });
    }
    else {
        failWithTooBigFile(responseData, res);
    }
}

function onChunkedUpload(fields, file, res) {
    console.log("Z");
    var size = parseInt(fields.qqtotalfilesize),
        uuid = fields.qquuid,
        index = fields.qqpartindex,
        totalParts = parseInt(fields.qqtotalparts),
        responseData = {
            success: false
        };

    file.name = fields.qqfilename;

    if (isValid(size)) {
        storeChunk(file, uuid, index, totalParts, function() {
                if (index < totalParts - 1) {
                    responseData.success = true;
                    res.send(responseData);
                }
                else {
                    combineChunks(file, uuid, function() {
                            responseData.success = true;
                            res.send(responseData);
                        },
                        function() {
                            responseData.error = "Problem conbining the chunks!";
                            res.send(responseData);
                        });
                }
            },
            function(reset) {
                responseData.error = "Problem storing the chunk!";
                res.send(responseData);
            });
    }
    else {
        failWithTooBigFile(responseData, res);
    }
}

function failWithTooBigFile(responseData, res) {
    responseData.error = "Too big!";
    responseData.preventRetry = true;
    res.send(responseData);
}

function onDeleteFile(req, res) {
    console.log("A");
    var uuid = req.params.uuid,
        dirToDelete = "uploadfiles/" + uuid;
    console.log(uuid);
    rimraf(dirToDelete, function(error) {
        if (error) {
            console.error("Problem deleting file! " + error);
            res.status(500);
        }

        res.send();
    });
}

function isValid(size) {
    return maxFileSize === 0 || size < maxFileSize;
}

function moveFile(destinationDir, sourceFile, destinationFile, success, failure) {
    console.log(destinationDir);
    mkdirp(destinationDir, function(error) {
        var sourceStream, destStream;

        if (error) {
            console.error("Problem creating directory " + destinationDir + ": " + error);
            failure();
        }
        else {
            sourceStream = fs.createReadStream(sourceFile);
            destStream = fs.createWriteStream(destinationFile);

            sourceStream
                .on("error", function(error) {
                    console.error("Problem copying file: " + error.stack);
                    destStream.end();
                    failure();
                })
                .on("end", function(){
                    destStream.end();
                    success();
                })
                .pipe(destStream);

            // res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
            //
            // var newImage = {
            //     imagePath: req.body.imagePath,
            //     status: req.body.status
            // };
            //
            // var myStat = "INSERT INTO Julia.FineUploader";
            //
            // var filePath0;
            // connection.query(myStat, function (err, results) {
            //     console.log("query statement : " + myStat);
            //
            //     if (!results[0].imagePath) {
            //         console.log("Error");
            //     } else {
            //         filePath0 = results[0];
            //         var JSONresult = JSON.stringify(results, null, "\t");
            //         console.log(JSONresult);
            //         res.send(JSONresult);
            //         res.end()
            //     }
            //
            // });
        }
    });
}

function moveUploadedFile(file, uuid, success, failure) {
    console.log("this is: " + uuid);
    // var destinationDir = uploadedFilesPath + uuid + "/",
    var destinationDir = "uploadfiles/",
        fileDestination = destinationDir + uuid + "_" + file.name;

    moveFile(destinationDir, file.path, fileDestination, success, failure);
}

function storeChunk(file, uuid, index, numChunks, success, failure) {
    var destinationDir = uploadedFilesPath + uuid + "/" + chunkDirName + "/",
        chunkFilename = getChunkFilename(index, numChunks),
        fileDestination = destinationDir + chunkFilename;

    moveFile(destinationDir, file.path, fileDestination, success, failure);
}

function combineChunks(file, uuid, success, failure) {
    var chunksDir = uploadedFilesPath + uuid + "/" + chunkDirName + "/",
        destinationDir = uploadedFilesPath + uuid + "/",
        fileDestination = destinationDir + file.name;


    fs.readdir(chunksDir, function(err, fileNames) {
        var destFileStream;

        if (err) {
            console.error("Problem listing chunks! " + err);
            failure();
        }
        else {
            fileNames.sort();
            destFileStream = fs.createWriteStream(fileDestination, {flags: "a"});

            appendToStream(destFileStream, chunksDir, fileNames, 0, function() {
                    rimraf(chunksDir, function(rimrafError) {
                        if (rimrafError) {
                            console.log("Problem deleting chunks dir! " + rimrafError);
                        }
                    });
                    success();
                },
                failure);
        }
    });
}

function appendToStream(destStream, srcDir, srcFilesnames, index, success, failure) {
    if (index < srcFilesnames.length) {
        fs.createReadStream(srcDir + srcFilesnames[index])
            .on("end", function() {
                appendToStream(destStream, srcDir, srcFilesnames, index + 1, success, failure);
            }).on("error", function(error) {
                console.error("Problem appending chunk! " + error);
                destStream.end();
                failure();
            })
            .pipe(destStream, {end: false});
    }
    else {
        destStream.end();
        success();
    }
}

function getChunkFilename(index, count) {
    var digits = new String(count).length,
        zeros = new Array(digits + 1).join("0");

    return (zeros + index).slice(-digits);
}