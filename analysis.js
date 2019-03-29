const fs = require("fs");
const path = require("path");

var checkResultFile = path.join(__dirname, "/seo/checkResult.txt");
var dieLinkInfoFile = path.join(__dirname, "/seo/dieLinks.txt"); 
fs.readFile(dieLinkInfoFile, "utf-8", function(err, json){
	if(err){
		return console.log(err);
	}

	var data = JSON.parse(json);
	//format
	var info = [];

	info.push({
		theme: "站内死链接",
		linsInfos : data
	});


	var nameMap = {
		"reffer": "1、来源页面",
		"targetUrl": "2、链接",
		"statusCode": "3、状态码",
		"location" : "4、重定向位置"
	};
	var fileString = "";

	fileString += "站内异常链接\n";
	fileString += data.map(function(item, index){

		var stringArr = [];

		Object.keys(item).forEach(function(key){
			if(nameMap[key]){
				stringArr.push(nameMap[key] + " : " + item[key]);

			}

			stringArr.sort();
		});

		return stringArr.join("\n");

	}).join("\n\n");

	console.log(fileString);

	fs.writeFile(checkResultFile, fileString, function(err){
		if(err){
			return console.log(err);
		}
		console.log("写入成功");
	});

	/*
	theme: 'xxx',
	
	目标页面：reffer
	链接：targetUrl，
	状态码：301


	

	 */
});
