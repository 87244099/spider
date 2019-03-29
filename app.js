//对于https的话，用http模块是请求不到的
var https = require("https");
var fs = require("fs");
var cheerio = require("cheerio");//解析html用的库

var options = {
	hostname: "cnodejs.org",
	port: 443,
	path: '/',
	method: "GET"
};

var resultFilePath = __dirname + "/result.html";

var request = https.request("https://cnodejs.org/", function(response){

	var resultString = "";
	response.on("data", function(buffer){
		// console.log(data);//拿到的是Buffer，要进行解析
		// console.log(buffer.toString("utf-8"));
		// console.log(response.constructor);
		resultString += buffer.toString("utf-8");
	});

	response.on("close", function(){


		var $ = cheerio.load(resultString);
		
		var list = [];
		$('.topic_title_wrapper').each(function(index, item){
			var $item = $(item);
			var type = $item.find('span').text().trim();
			var title = $item.find('.topic_title').text().trim();
			var url = $item.find('.topic_title').attr("href");

			list.push({
				type: type,
				title: title,
				url: url
			});
		});

		console.log(list);

		/*fs.writeFile(resultFilePath, resultString, function(err){
			if(err){
				return console.log(err);
			}
			console.log("result write to file");
		});
		*/

	});

});
//请求过程发生错误时
request.on("error", function(err){
	console.log("request error", err);
});

request.end();

function analysisHtml(html){


	return {

	};
}