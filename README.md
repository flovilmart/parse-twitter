parse-twitter
=============

Twitter API Wrapper for Parse


	var Twitter = require("cloud/Twitter");
	var user = //any valid Parse.User with twitter auth data;
	twitter = new Twitter(user);
	
	
	var authData = {};
	//valid auth data with
	/*
	authData.consumer_key = ;
	authData.consumer_secret = ;
	authData.auth_token = ;
	authData.auth_token_secret = ;
	*/
	twitter = new Twitter(authData);
	
	
	make calls:
	
	twitter.get(endpoint, params, body).then(function(response){....});
	twitter.post(endpoint, params, body).then(function(response){....});
	twitter.send(method, endpoint, params, body).then(function(response){....});