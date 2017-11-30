
// This file started its life as Glitch boilerplate. Time to make a mess.
// First off, tabs not spaces (except to align things). Make it work, then
// make it pretty. Keep it simple and dumb, no magic. (20171116/dphiffer)

var express = require('express');
var body_parser = require('body-parser');
var path = require('path');
var fs = require('fs');
var dotdata = require('./dotdata');
var sequence = require('./sequence');
var url_words = require('./url_words');

var app = express();

dotdata.init();

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function(request, response) {
	var root = path.dirname(__dirname);
	response.sendFile(root + '/views/index.html');
});

app.get("/:id", function(request, response) {
	var root = path.dirname(__dirname);
	response.sendFile(root + '/views/index.html');
});

// http://expressjs.com/en/api.html#req.body
app.use(body_parser.json()); // application/json
app.use(body_parser.urlencoded({ extended: true })); // application/x-www-form-urlencoded

// Inspired by Artisinal Integers, this just returns an incrementing integer
app.get("/api/id", function(request, response) {
	response.send({
		ok: 1,
		id: sequence.next()
	});
});

// Load config
app.get("/api/config", function(request, response) {
	var onsuccess = function(data) {
		if (! data.default_slug) {
			data.random_slug = url_words.random();
		}
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
	dotdata.get("config")
	       .then(onsuccess, onerror);
});

// Save config
app.post("/api/config", function(request, response) {
	var onsuccess = function(data) {
		response.send({
			ok: 1,
			data: data
		});
	};
	var onerror = function(err) {
		response.body({
			ok: 0,
			error: 'Error saving data.',
			data: {}
		}).status(400);
	};
	dotdata.set("config", request.body)
	       .then(onsuccess, onerror);
});

function load_map(slug) {

	return new Promise(function(load_resolve, load_reject) {

		dotdata.get('maps:' + slug).then(function(map) {

			var venues = [];

			var ready = function() {
				load_resolve({
					ok: 1,
					map: map,
					venues: venues
				});
			};

			var get_venue = function(id) {
				return new Promise(function(resolve, reject) {
					var name = "maps:" + map.id + ":" + id;
					dotdata.get(name).then(function(venue) {
						if (venue.active != "0") { // This is a kludge, the value should be 0 not "0"
							venues.push(venue);
						}
						resolve(venue);
					}, function(err) {
						reject(err);
					});
				});
			};

			dotdata.index("maps:" + map.id).then(function(index) {
				var venue_promises = [];
				for (var i = 0; i < index.data.length; i++) {
					venue_promises.push(get_venue(index.data[i]));
				}
				Promise.all(venue_promises).then(ready, load_reject);
			}, load_reject);

		}, load_reject);

	});
}

var save_map = function(request, response) {

	if (request.params.slug) {
		var slug = request.params.slug;
	} else {
		var slug = url_words.random();
	}

	var root = path.dirname(__dirname);
	var filename = root + '/.data/maps/' + slug + '.json';
	fs.stat(filename, function(err, stats) {

		var exists = (! err || err.code != 'ENOENT');
		if (! request.params.slug && exists) {
			// We were trying to pick a random URL slug, but accidentally picked
			// one that already exists! Try again...
			return save_map(request, response);
		}
		var map = request.body;
		if (! map.id) {
			map.id = sequence.next();
		}
		if (! map.slug) {
			map.slug = slug;
		}

		var onerror = function(details) {
			var error = details.error || 'Error saving map.';
			response.send({
				ok: 0,
				error: error
			});
		};

		var respond = function(data) {
			response.send({
				ok: 1,
				map: data.map,
				venues: data.venues
			});
		};

		var onsuccess = function() {
			if (map.slug != slug) {
				// Rename the data to match the new slug...
				var from = 'maps:' + slug;
				var to = 'maps:' + map.slug;
				dotdata.rename(from, to).then(function() {
					load_map(map.slug).then(respond, onerror);
				}, onerror);
			} else {
				load_map(map.slug).then(respond, onerror);
			}
		};

		if (map.slug != slug) {
			var rename_to = dotdata.filename('maps:' + map.slug);
			if (fs.existsSync(rename_to)) {
				return onerror({
					error: "The map '" + map.slug + "' already exists. Please choose another URL slug."
				});
			}
		}

		dotdata.set('maps:' + slug, map).then(onsuccess, onerror);
	});
};

// Create a new map
app.post("/api/map", function(request, response) {
	save_map(request, response);
});

// Update a map
app.post("/api/map/:slug", function(request, response) {
	save_map(request, response);
});

// Load a map
app.get("/api/map/:slug", function(request, response) {

	var onsuccess = function(data) {
		response.send({
			ok: 1,
			map: data.map,
			venues: data.venues
		});
	};

	var onerror = function() {

		// Doesn't exist? Presto, now it does!

		dotdata.get('config').then(function(config) {
			request.body = {
				name: config.default_name || request.params.slug,
				bbox: config.default_bbox
			};
			save_map(request, response);
		});
	};

	load_map(request.params.slug).then(onsuccess, onerror);
});

// Save a venue
app.post("/api/venue", function(request, response) {
	var onsuccess = function(data) {
		response.send({
			ok: 1,
			data: data
		});
	};
	var onerror = function(err) {
		response.body({
			ok: 0,
			error: 'Error saving data.',
			details: err,
			data: {}
		}).status(400);
	};
	var data = request.body;
	dotdata.set("maps:" + data.map_id + ":" + data.id, data)
	       .then(onsuccess, onerror);
});

// List the available icons
app.get("/api/icons", function(request, response) {
	var icons_dir = path.dirname(__dirname) + '/public/img/icons';
	fs.readdir(icons_dir, function(err, files) {
		var icons = [];
		var icon;
		for (var i = 0; i < files.length; i++) {
			icon = files[i].match(/(.+)\.svg/);
			if (icon) {
				icons.push(icon[1]);
			}
		}
		icons.sort();
		response.json({
			ok: 1,
			icons: icons
		});
	});
});

// listen for requests :)
var port = process.env.PORT || 4321;
var listener = app.listen(port, function() {
	console.log('Your app is listening on port ' + listener.address().port);
});
