/**
 * Created by Marlan on 11/14/2019.
 */

const express = require('express');
const app = express();

const bodyParser= require('body-parser');
const validator = require("email-validator");
const passwordValidator = require('password-validator');
const speakeasy = require("speakeasy");    //2FA library for nodejs
const flatCache = require('flat-cache');   //Use filesystem cache to associate a unique secret to a username
const cache = flatCache.load('nudata');

//Render single-page code from public folder
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({extended: true}));

//display initial page
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');;
});

//login endpoint
app.post('/login', function (req, res) {
    //schema to validate password
    let schema = new passwordValidator();
    schema
        .is().min(8)                              // Minimum length 8
        .has().uppercase()                              // Must have uppercase letters
        .has().lowercase()                              // Must have lowercase letters
        .has().digits()                                 // Must have digits
        .has().symbols();                               // Must have a special character
    let validUsername = validator.validate(req.body.username);
    let validPw = schema.validate(req.body.password);

    //Username and password pass validation
    if (validUsername && validPw) {
        if (!cache.getKey(req.body.username)) {  //if no key associated with username, generate one and render
            let secret = speakeasy.generateSecret();
            let QRCode = require('qrcode');
            QRCode.toDataURL(secret.otpauth_url, function (err, data_url) {
                cache.setKey(req.body.username, secret.base32);
                //Uncomment to persist association to filesystem even after system restart
                //cache.save();
                res.json({
                    "result": 0,
                    "message": "Please scan QR code and login with token",
                    "data": {
                        "authenticator_image_url": data_url
                    }
                })
            });
        } else { //username has a secret, validate the token entered in the authenticator field
            let base32secret = cache.getKey(req.body.username);
            let verified = speakeasy.totp.verify({ secret: base32secret,
                encoding: 'base32',
                token: req.body.authenticator_code });
            if (verified) {
                res.json({
                    "result": 0,
                    "message": "Successful"
                })
            } else {
                res.json({
                    "result": 1,
                    "message": "Incorrect token"
                })
            }
        }

    //Show reason for username/password failed validation
    } else if (validUsername && !validPw) {
        res.json({
            "result": 1,
            "message": "Invalid password (Must exceed 8 characters and contain an uppercase, lowercase, digit and special character)"
        });
    } else if (!validUsername && validPw) {
        res.json({
            "result": 1,
            "message": "Invalid email address"
        });
    }
});

app.listen(3000, function () {
    console.log('Server listening on port 3000!')
});





