
// This file started its life as Glitch boilerplate. Time to make a mess.
// First off, tabs not spaces (except to align things). Make it work, then
// make it pretty. Keep it simple and dumb, no magic. (20171116/dphiffer)

var express = require('express');
var body_parser = require('body-parser');
var dotdata = require('./dotdata');
var app = express();

dotdata.init();

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function(request, response) {
	response.sendFile(__dirname + '/views/index.html');
});

// http://expressjs.com/en/api.html#req.body
app.use(body_parser.json()); // application/json
app.use(body_parser.urlencoded({ extended: true })); // application/x-www-form-urlencoded

app.get("/api/dotdata/:name", function(request, response) {
	var onsuccess = function(data) {
		response.send({
			ok: 1,
			data: data
		});
	};
	var onerror = function(err) {
		response.send({
			ok: 0,
			error: err,
			data: {}
		});
	};
	dotdata.get(request.params.name)
	       .then(onsuccess, onerror);
});

app.post("/api/dotdata/:name", function(request, response) {
	var onsuccess = function(data) {
		response.send({
			ok: 1,
			data: data
		});
	};
	var onerror = function(err) {
		response.send({
			ok: 0,
			error: err,
			data: {}
		});
	};
	dotdata.set(request.params.name, request.body)
	       .then(onsuccess, onerror);
});

// listen for requests :)
var port = process.env.PORT || 4321;
var listener = app.listen(port, function() {
	console.log('Your app is listening on port ' + listener.address().port);
});
