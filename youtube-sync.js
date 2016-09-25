
const fs = require('fs');
const https = require('https');

var projectDir = "/projects/youtube-sync/";
process.chdir(projectDir);

function saveCache(name, data){
    try {
	var cacheDirStats = fs.statSync(projectDir + "cache");
    } catch(ex) {
	fs.mkdirSync(projectDir + 'cache', 0775);
    }
    //this write is async
    fs.writeFile(projectDir + "cache/" + name + ".json", JSON.stringify(data), function(err) {
	if(err) {
	    return console.log("couldn't save "+ name + " data to cache.", err);
	}
	//console.log("Updated cache " + name);
    });
};

function retrieveCache(name){
    try {
	var cachecontents = fs.readFileSync(projectDir + "cache/" + name + ".json",
					    { encoding:'utf8' });
	return JSON.parse(cachecontents);
    } catch(ex) {
	return null;
    }
};

function fetchEndpoint(url){
    return new Promise(function (fulfill, reject){
	https.get(url, (res) => {
	    //console.log('statusCode:', res.statusCode);
	    //console.log('headers:', res.headers);
	    
	    var data = "";
	    res.on('data', (d) => {
		data += d;
	    });
	    res.on('end', () => {
		var jsonData = JSON.parse(data);
		fulfill(jsonData);
	    });
	    
	}).on('error', (e) => {
	    reject(e);
	});
    });
};

//API Reference: https://developers.google.com/youtube/v3/docs/playlists/list#try-it
var urlPlaylistsList = 'https://www.googleapis.com/youtube/v3/playlists?part=contentDetails&key=AIzaSyDOTC3TT67WqMZa_KtgJ2LGdnyG2No5xOM&channelId=UCH-M2Z5bOm3uyfQuKQbqTaA&maxResults=50';//&maxResults=50


function fetchPlaylists(pageToken, current_playlists){
    return new Promise(function (fulfill, reject){
	var urlToGet = urlPlaylistsList;
	if("undefined" !== typeof(pageToken)){ urlToGet += ("&pageToken=" + pageToken); };
	var playlists = ("undefined" !== typeof(current_playlists)) ? current_playlists : [];
	fetchEndpoint(urlToGet).then(function(jsonData){
	    playlists = playlists.concat(jsonData.items);
	    if(playlists.length >= jsonData.pageInfo.totalResults){
		fulfill(playlists);
	    } else {
		fetchPlaylists(jsonData.nextPageToken, playlists).then(fulfill, function(){
		    reject('some iteration returned an error');
		});
	    }
	});
    });
};



//API Reference: https://developers.google.com/youtube/v3/docs/playlistItems/list
var urlItemsList = 'https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&key=AIzaSyDOTC3TT67WqMZa_KtgJ2LGdnyG2No5xOM&maxResults=50';

function fetchItems(playlistId, pageToken, current_items){
    return new Promise(function (fulfill, reject){
	var urlToGet = urlItemsList;
	urlToGet += "&playlistId=" + playlistId;
	if("undefined" !== typeof(pageToken)){ urlToGet += ("&pageToken=" + pageToken); };
	var items = ("undefined" !== typeof(current_items)) ? current_items : [];
	fetchEndpoint(urlToGet).then(function(jsonData){
	    items = items.concat(jsonData.items);
	    if(items.length >= jsonData.pageInfo.totalResults){
		fulfill(items);
	    } else {
		fetchItems(playlistId, jsonData.nextPageToken, items).then(fulfill, function(){
		    reject('some iteration returned an error');
		});
	    }
	});
    });
};


function workPlaylist(p, items){
    console.log('playlist ', p.id, '; items: ', items);
    //show playlists with only one item
    //if(items.length < 2){ console.log("https://www.youtube.com/playlist?list="+p.id); }
};


function workPlaylists(playlists){
    playlists.forEach(function(p){
	var itemsCache = retrieveCache('playlist-'+p.id+'-last');
	if(itemsCache){
	    workPlaylist(p, itemsCache);
	} else {
	    //console.log('fetching items for playlist ' + p.id);
	    fetchItems(p.id).then(function(items){
		var nowTime = (new Date()).getTime();
		saveCache('playlist-' + p.id + '-' + nowTime, items);
		fs.symlinkSync(projectDir + 'cache/playlist-'+p.id+'-'+nowTime+'.json', projectDir + 'cache/playlist-'+p.id+'-last.json');
		workPlaylist(p, items);
	    }, function(err){
		console.log('error:', err);
	    });
	}//end if cache else
    });//end forEach
}

var playlistsCache = retrieveCache('playlists-last');
if(playlistsCache){
    workPlaylists(playlistsCache);
} else {
    //console.log('fetching playlists data');
    fetchPlaylists().then(function(playlists){
	var nowTime = (new Date()).getTime();
	saveCache('playlists-' + nowTime, playlists);
	fs.symlinkSync(projectDir + 'cache/playlists-'+nowTime+'.json', projectDir + 'cache/playlists-last.json');
	workPlaylists(playlists);
    }, function(err){
	console.log('error:', err);
    });
}
