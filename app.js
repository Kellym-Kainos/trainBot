
const fs = require('fs');
let builder = require('botbuilder');
let trainUrl = "https://apis.opendatani.gov.uk/translink/";
let xmlExtension = ".xml";
let stationsJson = fs.readFileSync('stations.json');
let stationsArray = JSON.parse(stationsJson).stations;

var request = require('request');
var parser = require('xml2json');

let restify = require('restify');

//Create the server
let server = restify.createServer()

//Run the server continuously
server.listen(3978, function(){
    console.log('The server is running on ', server.name, server.url)
})

// Create chat connector with the default id and password
// Create connector and listen for messages
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

//When the server posts to /api/messages, make the connector listen to it.
server.post('/api/messages', connector.listen())

var bot = new builder.UniversalBot(connector, function (session) {
    session.send('Sorry, I did not understand \'%s\'. Type \'help\' if you need assistance.', session.message.text);
});

var recognizer = new builder.LuisRecognizer("https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/6c6c484b-f269-48a6-9eeb-07d5bc763f2e?subscription-key=5811ebd525b443b8badb31bb4e380aaa&timezoneOffset=0&verbose=true&q=");
bot.recognizer(recognizer);
// //Root Dialog
//bot.dialog('/', [greeting, getFromStation])

bot.dialog('checkOnTime', []);

function checkSavedTrains(stationFrom, 
    time=new Date().toLocaleTimeString(
        'en-GB', { hour12: false, 
        hour: "numeric", 
        minute: "numeric"}
    )
){
    time = time.replace(":", "");

    return session.userData.trains.filter(
        function(trains){return trains.time >= time }
    );
    
}

bot.dialog('checkOnTime', [
    function (session, args, next) {
        //extract entities
        var stationFrom = builder.EntityRecognizer.findEntity(args.intent.entities, 'train::stationFrom');
        session.dialogData.time = builder.EntityRecognizer.findEntity(args.intent.entities, 'train::time');
    
        
        //Check StationFrom
        if (!stationFrom){
           // builder.Prompts.text(session, 'Where is the train departing from?')
           builder.Prompts.choice(session, 'which station', stationsArray.map(function(obj) {
            return obj.name;}), { listStyle: 3 })
        }else{
            next({response: stationFrom});
        }

        // //Get station code
        // stationCode = getStationByName(stationFrom)[0].code;

        // //Get list of trains and filter by time
        // session.send("Station to:"+stationFrom+" .Time:"+time+" .Station code"+stationCode);
        // session.send(JSON.stringify(args.intent));
    },
    function(session, results){
        //If prompted for StationFrom, assign variable with response
        if (results.response){
            session.dialogData.stationFrom =  results.response.entity;
        }

        //Get StationCode
        session.dialogData.stationCode = getStationByName(session.dialogData.stationFrom)[0].code;

        //-- Put check here for no stations found
            //--Another function

        //Check time
        if (!session.dialogData.time){
            builder.Prompts.text(session, 'What time is the train departing?')
        }else{
            next({response: session.dialogData.time.entity});
        }
    },
    function(session, results){
          //If prompted for time, assign variable with response
          if (results.response){
            session.dialogData.time=  results.response;
        }

        //Get list of trains and filter by time
        //If found return
            //else show dialog of available trains
    },
    function(session, results){

    }
]).triggerAction({
    matches:'checkOnTime'
});


//Greeting
function greeting(session){
    builder.Prompts.text(session, "Hello. What station are you travelling from?");
}

//Name
function getFromStation(session, results){
    //Set name
    session.userData.fromStation = results.response;

    //Get station schedule
    trainData = getTrainData(session);

    stationCode = getStationByName(results.response)[0].code;
    console.log(stationCode);

    var request = require('request');

    var options = {
        object: true,
        reversible: false,
        coerce: false,
        sanitize: true,
        trim: true,
        arrayNotation: false,
        alternateTextNode: false
    };

    delayedMessage = "Not on time";
    notDelayedMessage = "On time";

    stationUrl = trainUrl+stationCode+xmlExtension;

    request(stationUrl, function (error, response, body) {
    trainData =  parser.toJson(body, options).StationBoard.Service[0];

    //Filter by time
    if (trainData.Delay.Minutes > 0){
        session.endDialog(delayedMessage);
    }else{
        session.endDialog(notDelayedMessage);
    }

    });
}

function getToStation(session, results){
    //Set name
    session.userData.toStation = results.response;

    //Get station schedule
    getTrainData(session);
}

//Get Station Code
function getStationByName(name) {
    console.log(name);
    return stationsArray.filter(
        function(stations){return stations.name == name}
    );
  }

//Get Train Data
function getTrainData(session){

    stationCode = getStationByName(session.userData.fromStation)[0].code;
    console.log(stationCode);

    var request = require('request');

    var options = {
        object: true,
        reversible: false,
        coerce: false,
        sanitize: true,
        trim: true,
        arrayNotation: false,
        alternateTextNode: false
    };


    stationUrl = trainUrl+stationCode+xmlExtension;
    console.log(stationUrl)
    request(stationUrl, function (error, response, body) {
        session.userData.trainData =  parser.toJson(body, options);
     // console.log('error:', error); // Print the error if one occurred
      console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
     // console.log('body:', parser.toJson(body, options)); // Print the HTML for the Google homepage.

     return session.userData.trainData.StationBoard.Service[0];
    });

}

// //Get Station Code
// function getStationByName(name) {
//     console.log(name);
//     return stationsArray.filter(
//         function(stations){return stations.name == name}
//     );
//   }

// //Get Train Data
// function getTrainData(session){

//     stationCode = getStationByName(session.userData.fromStation)[0].code;
//     console.log(stationCode);

//     var request = require('request');

//     var options = {
//         object: true,
//         reversible: false,
//         coerce: false,
//         sanitize: true,
//         trim: true,
//         arrayNotation: false,
//         alternateTextNode: false
//     };


//     stationUrl = trainUrl+stationCode+xmlExtension;
//     console.log(stationUrl)
//     request(stationUrl, function (error, response, body) {
//         session.userData.trainData =  parser.toJson(body, options);
//      // console.log('error:', error); // Print the error if one occurred
//       console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
//      // console.log('body:', parser.toJson(body, options)); // Print the HTML for the Google homepage.

//      return session.userData.trainData.StationBoard.Service[0];
//     });

// }