const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const M=require('../assets/photo-life-model.js');
const S=require('../assets/photo-seasons.js');
function renderer(search='') {
  const scope=vm.createContext({window:{PhotoLifeModel:M,PhotoSeasons:S},Image:class{},location:{search},URLSearchParams});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/photo-visitors.js'),'utf8'),scope);
  const r=scope.window.photoVisitors;
  r.assets=Object.fromEntries(['nebbia','keepers','deer','helicopter','paraglider'].map(id=>[id,{width:1,height:1}]));
  const drawn=[];r.sprite=(_ctx,id)=>{drawn.push(id);return true;};
  const ctx=new Proxy({}, {get:()=>()=>{}});
  const life={w:1672,h:941,hotspots:[],shadow(){}};
  const rect={x:0,y:0,scale:1};
  const scene={clipSky(){},isSky(){return true;}};
  return {r,drawn,ctx,life,rect,scene};
}
test('aircraft fly separately, leave gaps and stay absent at night',()=>{
  const {r,drawn,ctx,life,rect,scene}=renderer();
  const options={language:'it',animationTime:0};
  r.flights(life,ctx,scene,rect,{sunAltitude:30},options);
  assert.deepEqual(drawn,[]);
  for (let seconds=0;seconds<600;seconds++) {
    drawn.length=0;
    r.flights(life,ctx,scene,rect,{sunAltitude:30},{...options,animationTime:seconds*1000});
    assert.ok(drawn.length<=1);
  }
  drawn.length=0;
  r.flights(life,ctx,scene,rect,{sunAltitude:30},{...options,animationTime:50000});
  assert.deepEqual(drawn,['helicopter']);
  drawn.length=0;
  r.flights(life,ctx,scene,rect,{sunAltitude:30},{...options,animationTime:200000});
  assert.deepEqual(drawn,['paraglider']);
  drawn.length=0;
  r.flights(life,ctx,scene,rect,{sunAltitude:-8},{...options,animationTime:50000});
  assert.deepEqual(drawn,[]);
});
test('woodland pair appears near sunrise and sunset; keepers follow opening hours',()=>{
  const {r,drawn,ctx,life,rect}=renderer();
  const options={language:'it',hour:12,sunriseHour:7,sunsetHour:19};
  r.ground(life,ctx,rect,{sunAltitude:30},options,M.hutSchedule(12,7,19));
  assert.deepEqual(drawn,['keepers','nebbia']);
  drawn.length=0;
  r.ground(life,ctx,rect,{sunAltitude:6},{...options,hour:18.5},M.hutSchedule(18.5,7,19));
  assert.deepEqual(drawn,['keepers','nebbia','deer']);
  drawn.length=0;
  r.ground(life,ctx,rect,{sunAltitude:-20},{...options,hour:23},M.hutSchedule(23,7,19));
  assert.deepEqual(drawn,[]);
});

test('flight preview starts mid-flight and continues along the route',()=>{
  const {r,ctx,life,rect,scene}=renderer('?flightPreview=helicopter');
  const positions=[];
  r.sprite=(_ctx,id,x)=>{positions.push({id,x});return true;};
  r.flights(life,ctx,scene,rect,{sunAltitude:30},{language:'it',animationTime:0});
  r.flights(life,ctx,scene,rect,{sunAltitude:30},{language:'it',animationTime:10000});
  assert.equal(positions.length,2);
  assert.equal(positions[0].id,'helicopter');
  assert.ok(positions[1].x>positions[0].x);
});

test('winter keepers replace summer clothing and retain their accessible target',()=>{
  const {r,drawn,ctx,life,rect}=renderer();
  r.assets['keepers-winter']={width:1,height:1};
  r.ground(life,ctx,rect,{sunAltitude:30},{language:'it',hour:12,sunriseHour:7,sunsetHour:19,season:{clothing:1}},M.hutSchedule(12,7,19));
  assert.deepEqual(drawn,['keepers-winter','nebbia']);
  assert.ok(life.hotspots.some(p=>p.id==='keepers'));
});


test('snowfall suppresses both aircraft and their hotspots until the weather clears',()=>{
  for (const aircraft of ['helicopter','paraglider']) for (const reducedMotion of [false,true]) {
    const {r,drawn,ctx,life,rect,scene}=renderer('?flightPreview='+aircraft);
    const options={language:'it',animationTime:0,season:S.at({year:2026,month:12,day:15}),reducedMotion};
    r.flights(life,ctx,scene,rect,{sunAltitude:30},{...options,simMs:60000});
    assert.deepEqual(drawn,[]);
    assert.equal(life.hotspots.length,0);
    r.flights(life,ctx,scene,rect,{sunAltitude:30},{...options,simMs:500000});
    assert.deepEqual(drawn,[aircraft]);
    assert.ok(life.hotspots.some(p=>p.id===aircraft));
  }
});

test('keepers and dog shelter during snowfall and return when it stops',()=>{
  for (const reducedMotion of [false,true]) {
    const {r,drawn,ctx,life,rect}=renderer();
    r.assets['keepers-winter']={width:1,height:1};
    const options={language:'it',hour:12,sunriseHour:7,sunsetHour:19,
      season:S.at({year:2026,month:12,day:15}),reducedMotion};
    const schedule=M.hutSchedule(12,7,19);
    r.ground(life,ctx,rect,{sunAltitude:30},{...options,simMs:60000},schedule);
    assert.deepEqual(drawn,[]);
    assert.equal(life.hotspots.length,0);
    r.ground(life,ctx,rect,{sunAltitude:30},{...options,simMs:500000},schedule);
    assert.deepEqual(drawn,['keepers-winter','nebbia']);
    assert.ok(life.hotspots.some(p=>p.id==='keepers'));
    assert.ok(life.hotspots.some(p=>p.id==='nebbia'));
  }
});

test('sled follows winter coverage and stays outside during snowfall and at night',()=>{
  const {r,ctx,life,rect}=renderer();
  r.assets.sled={image:{width:100,height:200},left:0,top:0,width:100,height:200};
  life.assets={};
  let tints=0,draws=0;
  life.tinted=()=>{tints++;return {width:100,height:200};};
  const canvas={save(){},restore(){},globalAlpha:1,drawImage(){draws++;}};
  r.drawSled(life,canvas,{sunAltitude:30},{amount:0,snow:0});
  assert.equal(draws,0);
  for(const altitude of [30,-20])r.drawSled(life,canvas,{sunAltitude:altitude},{amount:1,snow:1});
  assert.equal(draws,2);
  assert.equal(tints,2);
  let sledDuringSnow=false;
  r.drawSled=()=>{sledDuringSnow=true;};
  r.ground(life,ctx,rect,{sunAltitude:30},{language:'it',hour:12,sunriseHour:7,sunsetHour:19,
    season:S.at({year:2026,month:12,day:15}),simMs:60000},M.hutSchedule(12,7,19));
  assert.ok(sledDuringSnow);
});

test('the keepers tooltip joins Albert and Benedikta with a Tyrolean heart',()=>{
  const {r,ctx,life,rect}=renderer();
  r.ground(life,ctx,rect,{sunAltitude:30},{language:'it',hour:12,sunriseHour:7,sunsetHour:19,
    season:S.at({year:2026,month:7,day:15}),simMs:60000},M.hutSchedule(12,7,19));
  const keepers=life.hotspots.find(p=>p.id==='keepers');
  assert.equal(keepers.name,'Albert e Benedikta');
  assert.deepEqual(JSON.parse(JSON.stringify(keepers.title)),['Albert',{badge:'tyrolean-heart'},'Benedikta']);
  assert.equal(life.hotspots.find(p=>p.id==='nebbia').title,undefined);
});

test('Anna changes activity with the season and sits below Nebbia between the cows',()=>{
  const {r,ctx,life,rect}=renderer();
  life.assets={};life.tinted=()=>({});
  for(const name of ['anna-summer','anna-winter'])r.assets[name]={image:{},width:100,height:95};
  const sprites=[];r.sprite=(_ctx,name,x,y,width,alpha)=>sprites.push({name,x,y,width,alpha});
  const options={language:'it',simMs:500000};
  for(const [clothing,expected] of [[0,'anna-summer'],[1,'anna-winter']]){
    sprites.length=0;life.hotspots=[];
    r.drawAnna(life,ctx,rect,{sunAltitude:30},{...options,season:{clothing,amount:clothing,snow:clothing}},{shuttersOpen:true});
    assert.deepEqual(sprites.map(p=>p.name),[expected]);
    assert.ok(sprites[0].y>683);
    assert.ok(sprites[0].x>1164 && sprites[0].x<1296);
    assert.ok(sprites[0].width>=30);
    assert.equal(life.hotspots[0].name,'Anna');
    assert.equal(life.hotspots[0].id,'anna');
    assert.equal(life.hotspots[0].rows.length,0);
  }
  sprites.length=0;life.hotspots=[];
  r.drawAnna(life,ctx,rect,{sunAltitude:30},{...options,season:{clothing:.5}},{shuttersOpen:true});
  assert.deepEqual(sprites.map(p=>p.alpha),[.5,.5]);
  assert.equal(life.hotspots.length,1);
});

test('Anna is absent at night and during snowfall, including with reduced motion',()=>{
  const {r,ctx,life,rect,drawn}=renderer();
  life.assets={};life.tinted=()=>({});
  r.assets['anna-winter']={image:{},width:100,height:95};
  const options={language:'it',season:S.at({year:2026,month:12,day:15})};
  for(const reducedMotion of [false,true]){
    r.drawAnna(life,ctx,rect,{sunAltitude:30},{...options,reducedMotion,simMs:60000},{shuttersOpen:true});
    r.drawAnna(life,ctx,rect,{sunAltitude:-20},{...options,reducedMotion,simMs:500000},{shuttersOpen:true});
    r.drawAnna(life,ctx,rect,{sunAltitude:30},{...options,reducedMotion,simMs:500000},{shuttersOpen:false});
  }
  assert.deepEqual(drawn,[]);
  assert.equal(life.hotspots.length,0);
});

test('Anna keeps her accessible name with a photographic edelweiss in her title',()=>{
  const {r,ctx,life,rect}=renderer();
  life.assets={};life.tinted=()=>({});
  for(const name of ['anna-summer','anna-winter'])r.assets[name]={image:{},width:100,height:95};
  for(const clothing of [0,1]){
    life.hotspots=[];
    r.drawAnna(life,ctx,rect,{sunAltitude:30},{simMs:500000,season:{clothing,amount:clothing,snow:clothing}},{shuttersOpen:true});
    assert.equal(life.hotspots[0].name,'Anna');
    assert.deepEqual(JSON.parse(JSON.stringify(life.hotspots[0].title)),['Anna',{badge:'edelweiss'}]);
  }
});
