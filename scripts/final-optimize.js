// 终极优化引擎 — 滑动窗口集成 + 特征降维 + 蒙特卡洛验证
var fs=require('fs');

// ============================================================
// 通用代码注入
// ============================================================
var SHARED_CODE=`
/* === 滑动窗口集成预测 === */
var ENSEMBLE_WINDOWS=[30,60,100,150,200];
function ensembleVote(computeFn,extractTopFn,k){
  var allVotes={};
  ENSEMBLE_WINDOWS.forEach(function(w){
    if(w>allDraws.length)return;
    var subset=allDraws.slice(0,w);
    var result=computeFn(subset);
    if(!result)return;
    var tops=extractTopFn(result,k);
    var winWeight=Math.exp(-0.01*(allDraws.length-w)); // 更大窗口=更多数据=更高权重
    tops.forEach(function(num,rank){allVotes[num]=(allVotes[num]||0)+winWeight*(k-rank)/k});
  });
  return Object.entries(allVotes).sort(function(a,b){return b[1]-a[1]}).slice(0,k).map(function(x){return parseInt(x[0])});
}

/* === 蒙特卡洛交叉验证 === */
function monteCarloBacktest(runBacktestFn,iterations){
  iterations=iterations||20;
  var results=[];
  var original=allDraws;
  for(var iter=0;iter<iterations;iter++){
    // Bootstrap采样：随机抽取80%数据
    var sample=[],used={};
    var targetSize=Math.floor(allDraws.length*0.8);
    while(sample.length<targetSize){
      var idx=Math.floor(Math.random()*allDraws.length);
      if(!used[idx]){used[idx]=true;sample.push(allDraws[idx])}
    }
    allDraws=sample.sort(function(a,b){return parseInt(b.issue)-parseInt(a.issue)});
    var btResult=runBacktestFn();
    if(btResult)results.push(btResult);
  }
  allDraws=original; // 恢复
  // 聚合统计
  var sum={f1:0,prec:0,rec:0,pl:0};
  results.forEach(function(r){sum.f1+=parseFloat(r.f1);sum.prec+=parseFloat(r.prec);sum.rec+=parseFloat(r.rec);sum.pl+=parseFloat(r.pl)});
  var n=results.length||1;
  return{
    f1Mean:(sum.f1/n).toFixed(3),precMean:(sum.prec/n).toFixed(1)+'%',recMean:(sum.rec/n).toFixed(1)+'%',
    plMean:(sum.pl/n).toFixed(2),samples:n,
    f1Std:calcStd(results.map(function(r){return parseFloat(r.f1)})).toFixed(3),
    plStd:calcStd(results.map(function(r){return parseFloat(r.pl)})).toFixed(2)
  };
}
function calcStd(arr){var m=arr.reduce(function(a,b){return a+b},0)/arr.length;return Math.sqrt(arr.reduce(function(s,x){return s+Math.pow(x-m,2)},0)/arr.length)}
`;

// ============================================================
// 3D 专属优化
// ============================================================
var CODE_3D=`
/* === 3D 特征降维: 关联(cs)+邻号(ns)合并为空间因子 === */
// 在computePositionScores中,用cs*0.16替代 cs*0.08+ns*0.08
/* === 3D 蒙特卡洛回测增强 === */
function mcBacktest3D(){
  var n=parseInt(document.getElementById('backtestPeriod').value)||20;
  function runOne(){var si=0,results=[];for(var i=n-1;i>=0;i--){var ti=si+i;if(ti>=allDraws.length)continue;var past=allDraws.slice(ti+1);if(past.length<10)continue;var sc=[computePositionScores(past,0),computePositionScores(past,1),computePositionScores(past,2)];if(sc.some(function(s){return!s}))continue;var pr=[sc[0][0].num,sc[1][0].num,sc[2][0].num],act=allDraws[ti],h=0;for(var p=0;p<3;p++)if(pr[p]===act.digits[p])h++;results.unshift({hits:h})}return calcMetrics3D(results)}
  var mc=monteCarloBacktest(runOne,30);
  document.getElementById('backtestLoading').innerHTML='🎲 蒙特卡洛(30次): F1='+mc.f1Mean+'±'+mc.f1Std+' | P='+mc.precMean+' | R='+mc.recMean+' | 盈亏='+mc.plMean+'±'+mc.plStd;
  document.getElementById('mcStats').innerHTML=mc.samples+'次bootstrap采样(80%)&nbsp;F1均值='+mc.f1Mean+'&nbsp;F1波动='+mc.f1Std;
}

/* === 3D 集成预测 === */
function ensemblePredict3D(){
  function extractTop(r,k){return r.scores[0].slice(0,k).map(function(x){return x.num})}
  // 对每个位置分别集成
  var results=[];
  for(var pos=0;pos<3;pos++){
    var votes={};
    ENSEMBLE_WINDOWS.forEach(function(w){
      if(w>allDraws.length)return;
      var subset=allDraws.slice(0,w);
      var sc=computePositionScores(subset,pos);
      if(!sc)return;
      var ww=Math.exp(-0.01*(allDraws.length-w));
      sc.slice(0,5).forEach(function(x,rank){votes[x.num]=(votes[x.num]||0)+ww*(5-rank)/5});
    });
    results.push(Object.entries(votes).sort(function(a,b){return b[1]-a[1]}));
  }
  // 组六推荐：每位置取最高分且不重复
  var used={},tops=[];
  for(var pos=0;pos<3;pos++){
    for(var i=0;i<results[pos].length;i++){
      var n=parseInt(results[pos][i][0]);
      if(!used[n]){used[n]=true;tops.push(n);break}
    }
  }
  return tops;
}
`;

// ============================================================
// SSQ 专属优化
// ============================================================
var CODE_SSQ=`
/* === SSQ 特征降维: 连号+重号合并为序列因子 === */
/* === SSQ 蒙特卡洛 === */
function mcBacktestSSQ(){
  var n=parseInt(document.getElementById('backtestPeriod').value)||20;
  function runOne(){var results=[];for(var i=n-1;i>=0;i--){var ti=i;if(ti>=allDraws.length)continue;var past=allDraws.slice(ti+1);if(past.length<10)continue;var r=generateRecommendationFrom(past);if(!r)continue;var act=allDraws[ti];var rh=0;r.recReds.forEach(function(n){if(act.red.indexOf(n)>=0)rh++});var bh=r.recBlue===act.blue;results.unshift({redHits:rh,blueHit:bh})}return calcMetricsSSQ(results)}
  var mc=monteCarloBacktest(runOne,20);
  document.getElementById('backtestLoading').innerHTML='🎲 蒙特卡洛(20次): F1='+mc.f1Mean+'±'+mc.f1Std+' | 盈亏='+mc.plMean+'±'+mc.plStd;
  document.getElementById('mcStats').innerHTML=mc.samples+'次采样&nbsp;F1均值='+mc.f1Mean+'&nbsp;标准差='+mc.f1Std;
}

/* === SSQ 集成预测 === */
function ensemblePredictSSQ(){
  var votes={};
  ENSEMBLE_WINDOWS.forEach(function(w){
    if(w>allDraws.length)return;
    var subset=allDraws.slice(0,w);
    var r=generateRecommendationFrom(subset);
    if(!r)return;
    var ww=Math.exp(-0.01*(allDraws.length-w));
    r.recReds.forEach(function(n,rank){votes[n]=(votes[n]||0)+ww*(6-rank)/6});
  });
  return Object.entries(votes).sort(function(a,b){return b[1]-a[1]}).slice(0,6).map(function(x){return parseInt(x[0])}).sort(function(a,b){return a-b});
}
`;

// ============================================================
// DLT 专属优化
// ============================================================
var CODE_DLT=`
/* === DLT 特征降维: 黄金分割(gz)+012路黄金融合(rg)合并 === */
/* === DLT 蒙特卡洛 === */
function mcBacktestDLT(){
  var n=parseInt(document.getElementById('backtestPeriod').value)||20;
  function runOne(){var results=[];for(var i=n-1;i>=0;i--){var ti=i;if(ti>=allDraws.length)continue;var past=allDraws.slice(ti+1);if(past.length<10)continue;var r=generateRecommendationFrom(past);if(!r)continue;var act=allDraws[ti];var fh=0;r.recFront.forEach(function(n){if(act.front.indexOf(n)>=0)fh++});var bh=0;r.recBack.forEach(function(n){if(act.back.indexOf(n)>=0)bh++});results.unshift({totalHits:fh+bh,backHits:bh})}return calcMetricsDLT(results)}
  var mc=monteCarloBacktest(runOne,20);
  document.getElementById('backtestLoading').innerHTML='🎲 蒙特卡洛(20次): F1='+mc.f1Mean+'±'+mc.f1Std+' | 盈亏='+mc.plMean+'±'+mc.plStd;
}
`;

// ============================================================
// 注入所有代码
// ============================================================
function injectAfter(html,marker,injection){
  var idx=html.indexOf(marker);
  if(idx<0){console.log('  NOT FOUND: '+marker.substring(0,50));return html}
  return html.substring(0,idx+marker.length)+'\n'+injection+html.substring(idx+marker.length);
}

// --- 3D ---
var fc3d=fs.readFileSync('福彩3D/index.html','utf8');
// 注入共享代码
fc3d=injectAfter(fc3d,'function dcy(i){return Math.exp(-DECAY_L*i)}','\n'+SHARED_CODE);
// 注入3D专属代码
fc3d=injectAfter(fc3d,'/* === BACKTEST','\n'+CODE_3D);
// 合并 cs+ns 权重（减少特征冗余）
fc3d=fc3d.replace('os*0.18+fs*0.20+ts*0.15+rs*0.10+ps*0.10+cs*0.08+ns*0.08+pats*0.05+primeS*0.06',
                   'os*0.18+fs*0.20+ts*0.15+rs*0.10+ps*0.12+nb*0.14+pats*0.05+primeS*0.06');
// 修改 neighborScore 引用以匹配降维后的变量名
fc3d=fc3d.replace('cs*0.08+ns*0.08','nb*0.14'); // 备份兼容
// 在回测按钮旁加蒙特卡洛按钮
fc3d=fc3d.replace('onclick=\"runBacktest()\"','onclick=\"runBacktest()\"');
fc3d=fc3d.replace('<button class=\"btn btn-accent\" onclick=\"runBacktest()\">运行回测</button>',
                   '<button class=\"btn btn-accent\" onclick=\"runBacktest()\">运行回测</button> <button class=\"btn btn-accent\" onclick=\"mcBacktest3D()\" style=\"background:var(--purple)\">🎲 蒙特卡洛</button> <span id=\"mcStats\" style=\"font-size:0.6rem;color:var(--text2)\"></span>');
fs.writeFileSync('福彩3D/index.html',fc3d,'utf8');

// --- SSQ ---
var ssq=fs.readFileSync('双色球/index.html','utf8');
ssq=injectAfter(ssq,'function dcy(i){return Math.exp(-DECAY_L*i)}','\n'+SHARED_CODE);
ssq=injectAfter(ssq,'/* === BACKTEST','\n'+CODE_SSQ);
// 合并 consScore+repScore 为序列因子
ssq=ssq.replace('consScore*0.05+repScore*0.05','patternScore*0.10');
// 修改consScore和repScore的计算合并
ssq=ssq.replace('var consScore','var patternScore=0'); // 后续调整
ssq=ssq.replace('<button class=\"btn btn-accent\" onclick=\"runBacktest()\">运行回测</button>',
                 '<button class=\"btn btn-accent\" onclick=\"runBacktest()\">运行回测</button> <button class=\"btn btn-accent\" onclick=\"mcBacktestSSQ()\" style=\"background:var(--purple)\">🎲 蒙特卡洛</button> <span id=\"mcStats\" style=\"font-size:0.6rem;color:var(--text2)\"></span>');
fs.writeFileSync('双色球/index.html',ssq,'utf8');

// --- DLT ---
var dlt=fs.readFileSync('大乐透/index.html','utf8');
dlt=injectAfter(dlt,'function dcy(i){return Math.exp(-DECAY_L*i)}','\n'+SHARED_CODE);
dlt=injectAfter(dlt,'/* === BACKTEST','\n'+CODE_DLT);
// 合并 gz+rg 为空间路由融合因子
dlt=dlt.replace('find(frontGz,n).score*W[2]+find(frontEt,n).score*W[3]+find(frontFib,n).score*W[4]+find(frontGv,n).score*W[5]+find(frontMo,n).score*W[6]+find(frontRG,n).score*W[7]',
               'find(frontGz,n).score*W[2]*0.6+find(frontRG,n).score*W[7]*1.4+find(frontEt,n).score*W[3]+find(frontFib,n).score*W[4]+find(frontGv,n).score*W[5]+find(frontMo,n).score*W[6]');
dlt=dlt.replace('find(backGz,n).score*W[2]+find(backEt,n).score*W[3]+find(backFib,n).score*W[4]+find(backGv,n).score*W[5]+find(backMo,n).score*W[6]+find(backRG,n).score*W[7]',
               'find(backGz,n).score*W[2]*0.6+find(backRG,n).score*W[7]*1.4+find(backEt,n).score*W[3]+find(backFib,n).score*W[4]+find(backGv,n).score*W[5]+find(backMo,n).score*W[6]');
dlt=dlt.replace('<button class=\"btn btn-accent\" onclick=\"runBacktest()\">运行回测</button>',
                 '<button class=\"btn btn-accent\" onclick=\"runBacktest()\">运行回测</button> <button class=\"btn btn-accent\" onclick=\"mcBacktestDLT()\" style=\"background:var(--purple)\">🎲 蒙特卡洛</button>');
fs.writeFileSync('大乐透/index.html',dlt,'utf8');

// ============================================================
// 验证语法
// ============================================================
console.log('--- 语法验证 ---');
[{name:'3D',f:fc3d},{name:'SSQ',f:ssq},{name:'DLT',f:dlt}].forEach(function(app){
  try{
    var s=app.f.indexOf('<script>')+8,e=app.f.indexOf('</script>',s);
    new Function(app.f.substring(s,e));
    console.log('✅ '+app.name);
  }catch(err){
    console.log('❌ '+app.name+': '+err.message.substring(0,80));
  }
});
console.log('\n=== 全部完成 ===');
