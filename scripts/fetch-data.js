// 开奖数据抓取脚本 - 由 GitHub Actions 每小时执行
// 抓取三个彩种的最新数据并保存到 data/ 目录
var https=require('https'),http=require('http'),fs=require('fs'),path=require('path');

var DATA_DIR=path.join(__dirname,'..','data');
if(!fs.existsSync(DATA_DIR))fs.mkdirSync(DATA_DIR,{recursive:true});

function fetch(url){
  return new Promise(function(resolve,reject){
    var client=url.startsWith('https')?https:http;
    var u=new URL(url);
    var opts={hostname:u.hostname,path:u.pathname+u.search,method:'GET',headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','Accept':'text/html,application/json,application/xhtml+xml','Accept-Language':'zh-CN,zh;q=0.9'},timeout:30000};
    client.get(opts,function(res2){
      var body='';res2.on('data',function(c){body+=c});res2.on('end',function(){resolve(body)});
    }).on('error',function(e){reject(e)});
  });
}

function save(name,data){fs.writeFileSync(path.join(DATA_DIR,name+'.json'),JSON.stringify(data),'utf8');console.log('✅ '+name+': '+data.length+'条');}

async function fetchSSQ(){
  try{
    var raw=await fetch('https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=ssq&issueCount=200');
    var j=JSON.parse(raw);
    if(j&&j.result&&j.result.length>50){
      var draws=j.result.map(function(x){return{issue:x.code,date:x.date,red:x.red.split(',').map(Number).sort(function(a,b){return a-b}),blue:parseInt(x.blue)}});
      save('ssq',draws);return draws;
    }
  }catch(e){console.log('❌ SSQ:',e.message)}
  return null;
}

async function fetch3D(){
  try{
    var raw=await fetch('https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=3d&issueCount=200');
    var j=JSON.parse(raw);
    if(j&&j.result&&j.result.length>50){
      var draws=j.result.map(function(x){return{issue:x.code,date:x.date,digits:[parseInt(x.red.charAt(0)),parseInt(x.red.charAt(1)),parseInt(x.red.charAt(2))]}});
      save('3d',draws);return draws;
    }
  }catch(e){console.log('❌ 3D:',e.message)}
  return null;
}

async function fetchDLT(){
  try{
    var raw=await fetch('https://datachart.500.com/dlt/history/newinc/history.php?start=25001&end=26999');
    var draws=[];
    var re=/<td class="t_tr1">\s*(\d{5})\s*<\/td>/g,im;
    while((im=re.exec(raw))!==null){
      if(parseInt(im[1])<25000)continue;
      var ctx=raw.substring(im.index,im.index+500);
      var f2=ctx.match(/<td class="cfont2">(\d+)<\/td>/gi);
      var f4=ctx.match(/<td class="cfont4">(\d+)<\/td>/gi);
      var dt=ctx.match(/<td class="t_tr1">(\d{4}-\d{2}-\d{2})<\/td>/);
      if(f2&&f2.length>=5&&f4&&f4.length>=2&&dt){
        var fronts=f2.slice(0,5).map(function(t){var m=t.match(/>(\d+)</);return m?parseInt(m[1]):0});
        var backs=f4.slice(0,2).map(function(t){var m=t.match(/>(\d+)</);return m?parseInt(m[1]):0});
        draws.push({issue:im[1],date:dt[1],front:fronts,back:backs});
      }
    }
    if(draws.length>50){save('dlt',draws);return draws}
  }catch(e){console.log('❌ DLT:',e.message)}
  return null;
}

(async function(){
  console.log('🔄 开始抓取开奖数据...');
  console.log(new Date().toISOString());
  await Promise.all([fetchSSQ(),fetch3D(),fetchDLT()]);
  console.log('✅ 完成');
})();
