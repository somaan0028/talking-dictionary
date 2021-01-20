const express = require('express');
const app = express();

//used in the emptyDir() function that deletes all files in a dir
const path = require("path")

//so that i can use fetch using the package "node-fetch"
const fetch = require("node-fetch");


var url = require('url');

// get the credentials required for the ibm api
const credentials = require('./credentials');


//for the IBM api
const fs = require('fs');
const TextToSpeechV1 = require('ibm-watson/text-to-speech/v1');
const { IamAuthenticator } = require('ibm-watson/auth');
const textToSpeech = new TextToSpeechV1({
    authenticator: new IamAuthenticator({ apikey: credentials.ibmCredentials.apikey }),
    serviceUrl: credentials.ibmCredentials.serviceUrl
});


// set view engine
app.set('view engine', 'ejs');

//for static files
app.use(express.static('public'));

//Middleware for parsing post requests
app.use(express.urlencoded({ extended: true }));


///////////////////////////////////////////
//           FUNCTIONS DEFINED
///////////////////////////////////////////


// getting the audio from ibm text-to-speech api
function getAudiofromAPI(theText,voice,word, res){
    const synthesizeParams = {
        text: theText,
        accept: 'audio/mp3',
        voice: voice,
    };

    
    textToSpeech
      .synthesize(synthesizeParams)
      .then(response => {
        const audio = response.result;

        // for a unique filename
        var filename = new Date().getTime();
        var pathOfFile = 'public/audio/' + filename + '.mp3';
        console.log("About to begin write stream");
        audio.pipe(fs.createWriteStream(pathOfFile).on('finish', function() {
            console.log("Write Stream created");

            res.render('home', {audio: true, filename: filename + '.mp3', word: word, definition: theText, msgError: false, audioError: false});
        }));
      })
      .catch((err) => {
            // in case in out of the 1000 chars per month limit and an error occurs  
            console.log(err);
            res.render('home', {audio: false, filename: null, word: word, definition: theText, msgError: false, audioError: true});
    });
}


//deletes a full or empty directory
function removeDir(path) {
  if (fs.existsSync(path)) {
    const files = fs.readdirSync(path)

    if (files.length > 0) {

      files.forEach(function(filename) {
        if (fs.statSync(path + "/" + filename).isDirectory()) {
          removeDir(path + "/" + filename)
        } else {
          fs.unlinkSync(path + "/" + filename)
        }
      })

      fs.rmdirSync(path)
    } else {
      fs.rmdirSync(path)
    }
  } else {
    console.log("Directory path not found.")
  }
}

//empties the entire directory
function emptyDir(path){
    const files = fs.readdirSync(path)

    if (files.length > 0) {

      files.forEach(function(filename) {
        if (fs.statSync(path + "/" + filename).isDirectory()) {
          removeDir(path + "/" + filename)
        } else {
          fs.unlinkSync(path + "/" + filename)
        }
      })
    }
    console.log('Everything in the Dir has been deleted');
}


///////////////////////////////////////////
//           ROUTES CREATED
//////////////////////////////////////////

// create home route
app.get('/', (req, res) => {

    res.render('home',  {audio: false, filename: false, msgError: false, audioError: false});
});

app.post('/get-meaning', (req, res) => {

    // console.log(req.body);
    var theWord = req.body.theText;

    var thepath = "https://owlbot.info/api/v4/dictionary/" + theWord;
    var definition;

    // getting the meaning from the owlbot api
    fetch(thepath, {
        headers: {
            Authorization: credentials.owlbotCredentials.token
        }
    })
    .then((response) => {
        // console.log("Got the meaning");
        // console.log(response);
        return response.json()
      })
    .then((data) => {
        definition = data.definitions[0].definition

        // redirects to /get-audio url with the following query parameters
        res.redirect(url.format({
            pathname:"/get-audio",
            query: {
                "theWord": theWord,
                "definition": definition,
                "voice": req.body.voice,
            }
        }));

    })
    .catch((err) => {
        console.log(err);
        console.log("ERROR getting the meaning!!");
        res.render('home', {audio: false, filename: null, word: theWord, definition: null, msgError: true, audioError: false});
    });

});


//deletes old audio file from server and fires the getAudiofromAPI() function
app.get('/get-audio', (req, res) => {

    var def = req.query.definition;
    var voice = req.query.voice;
    var word = req.query.theWord;

    emptyDir('public/audio');

    getAudiofromAPI(def,voice,word, res);
});


//final link where audio will be played
app.get('/playclip',(req, res) => {
    console.log(req.query.audio);
    res.render('home', {audio: req.query.audio, filename: req.query.file + '.mp3', word: req.query.word})
});


//starts server
app.listen(3000, () => {
    console.log('app now listening for requests on port 3000');
});