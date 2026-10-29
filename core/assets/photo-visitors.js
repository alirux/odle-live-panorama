/* Photographic figures keep fixed ground positions. Flight timings follow
 * the occasional passages in the illustrated panorama. */
(() => {
  const M = window.PhotoLifeModel;
  // ?noAnna=1 leaves the girl out
  const SHOW_ANNA = new URLSearchParams(location.search).get('noAnna') !== '1';
  class PhotoVisitors {
    constructor() {
      this.assets = {};
      this.started = null;
      for (const name of ['nebbia','deer','keepers','keepers-winter','sled','anna-summer','anna-winter','paraglider','helicopter']) {
        const image = new Image();
        image.onload = () => {
          // Find transparent margins once, so figure sizes refer to their bodies.
          const canvas = document.createElement('canvas');
          canvas.width = image.width; canvas.height = image.height;
          const c = canvas.getContext('2d', {willReadFrequently:true});
          c.drawImage(image,0,0);
          const data = c.getImageData(0,0,image.width,image.height).data;
          let left=image.width, top=image.height, right=0, bottom=0;
          for (let y=0;y<image.height;y++) for (let x=0;x<image.width;x++) {
            if (data[(y*image.width+x)*4+3] > 20) {
              left=Math.min(left,x); right=Math.max(right,x);
              top=Math.min(top,y); bottom=Math.max(bottom,y);
            }
          }
          this.assets[name]={image,left,top,width:right-left+1,height:bottom-top+1};
        };
        image.src=`assets/photo/${name}.webp`;
      }
    }
    sprite(ctx,name,x,y,width,alpha=1,plate=null) {
      const a=this.assets[name]; if (!a || alpha<.01) return false;
      const height=width*a.height/a.width;
      ctx.save(); ctx.globalAlpha*=alpha;
      const source = plate || a.image;
      const sx = source.width / a.image.width, sy = source.height / a.image.height;
      ctx.drawImage(source,a.left*sx,a.top*sy,a.width*sx,a.height*sy,x-width/2,y-height,width,height);
      ctx.restore(); return true;
    }
    target(life,rect,id,name,x,y,radius,rows,title) {
      life.hotspots.push({...M.worldToScreen(rect,x,y),id,name,radius:Math.max(10,radius*rect.scale),rows,title});
    }
    drawSled(life,ctx,state,season) {
      const a = this.assets.sled;
      const amount = season?.snow || 0;
      if (!a || amount <= 0) return;
      life.assets.sled = a.image;
      const plate = life.tinted('sled',state);
      const sx = plate.width / a.image.width, sy = plate.height / a.image.height;
      const width = 19, height = width * a.height / a.width;
      ctx.save(); ctx.globalAlpha *= amount;
      ctx.drawImage(plate,a.left*sx,a.top*sy,a.width*sx,a.height*sy,
        1082-width/2,657-height,width,height);
      ctx.restore();
    }
    drawAnna(life,ctx,rect,state,options,schedule) {
      const daylight = M.smooth(-3,5,state.sunAltitude);
      if (!SHOW_ANNA || !schedule.shuttersOpen || daylight < .01 ||
        window.PhotoSeasons.snowfall(options.season,options.simMs) > .001) return;
      const winter = options.season?.clothing || 0;
      const x = 1242, y = 716, width = 31;
      const variants = [['anna-summer',1-winter],['anna-winter',winter]];
      if (variants.some(([name,weight]) => this.assets[name] && weight > .001)) {
        life.shadow(ctx,x,y-1,width*.4,2,.22*daylight);
      }
      let visible = 0, height = 0;
      for (const [name,weight] of variants) {
        const a = this.assets[name];
        if (!a || weight <= .001) continue;
        life.assets[name] = a.image;
        this.sprite(ctx,name,x,y,width,daylight*weight,life.tinted(name,state));
        visible += weight;
        height += width*a.height/a.width*weight;
      }
      if (visible > 0 && daylight*visible > .35) this.target(life,rect,'anna','Anna',x,y-height/visible/2,16,[],['Anna',{badge:'edelweiss'}]);
    }
    ground(life,ctx,rect,state,options,schedule) {
      this.drawAnna(life,ctx,rect,state,options,schedule);
      this.drawSled(life,ctx,state,options.season);
      const en=options.language==='en';
      const daylight=M.smooth(-3,5,state.sunAltitude);
      const figures=[
        {asset:'keepers',x:1243,y:675,width:36,name:en?'Albert and Benedikta':'Albert e Benedikta',rows:[],title:['Albert',{badge:'tyrolean-heart'},'Benedikta']},
        {asset:'nebbia',x:1249,y:683,width:30,name:'Nebbia',rows:[[en?'Type':'Tipo',en?'Sheepdog':'Cane da pastore']]}
      ];
      const snowing = window.PhotoSeasons.snowfall(options.season, options.simMs) > .001;
      if (schedule.shuttersOpen && !snowing) for (const f of figures) {
        if (!this.assets[f.asset] || daylight<.01) continue;
        life.shadow(ctx,f.x,f.y,f.width*.45,2,.25*daylight);
        if (f.asset === 'keepers' && this.assets['keepers-winter']) {
          const winter = options.season?.clothing || 0;
          if (winter < 1) this.sprite(ctx,'keepers',f.x,f.y,f.width,daylight * (1 - winter));
          if (winter > 0) this.sprite(ctx,'keepers-winter',f.x,f.y,f.width,daylight * winter);
        } else this.sprite(ctx,f.asset,f.x,f.y,f.width,daylight);
        if (daylight>.35) this.target(life,rect,f.asset,f.name,f.x,f.y-f.width*this.assets[f.asset].height/this.assets[f.asset].width/2,f.width*.55,f.rows,f.title);
      }
      // The pair is present only around the local sunrise and sunset.
      const dawn=1-M.smooth(.6,1.5,Math.abs(options.hour-options.sunriseHour));
      const dusk=1-M.smooth(.6,1.5,Math.abs(options.hour-options.sunsetHour));
      const deerAlpha=Math.max(dawn,dusk)*daylight;
      if (this.assets.deer && deerAlpha>.01) {
        life.shadow(ctx,980,710,17,2,.25*deerAlpha);
        this.sprite(ctx,'deer',980,710,36,deerAlpha);
        if (deerAlpha>.35) this.target(life,rect,'deer',en?'Selva and Ghianda':'Selva e Ghianda',980,697,20,
          [[en?'Roe deer and fawn':'Capriola e cerbiatto',en?'At the forest edge':'Sul margine del bosco']]);
      }
    }
    flights(life,ctx,scene,rect,state,options) {
      if (this.started===null) this.started=options.animationTime;
      if (state.sunAltitude<5) return;
      // They fly at wall-clock pace: with the day sped up they would cross a
      // sky that races past them, so they stay away.
      if (options.season && options.season.accelerated) return;
      const elapsed=(options.animationTime-this.started)/1000;
      const preview=new URLSearchParams(location.search).get('flightPreview');
      const offset=preview==='helicopter'?25+65*.46:preview==='paraglider'?150+130*.46:0;
      const cycle=(((elapsed+offset)%300)+300)%300;
      const en=options.language==='en';
      const flights=[
        {id:'helicopter',start:25,duration:65,width:29,name:en?'Rescue helicopter':'Elicottero di soccorso'},
        {id:'paraglider',start:150,duration:130,width:32,name:en?'Paraglider':'Parapendio'}
      ];
      const snowing = window.PhotoSeasons.snowfall(options.season, options.simMs) > .001;
      for (const f of flights) {
        if (snowing) continue;
        const t=(cycle-f.start)/f.duration;
        if (t<0 || t>1 || !this.assets[f.id]) continue;
        const x=f.id==='helicopter'?-80+t*1832:1280-t*800;
        const y=f.id==='helicopter'?140+Math.sin(t*Math.PI)*40:120+Math.sin(t*5)*25;
        const opacity=M.smooth(0,.06,t)*(1-M.smooth(.94,1,t));
        ctx.save(); scene.clipSky(ctx,life.w,life.h);
        ctx.translate(rect.x,rect.y); ctx.scale(rect.scale,rect.scale);
        this.sprite(ctx,f.id,x,y,f.width,opacity);
        ctx.restore();
        const a=this.assets[f.id];
        const centreY=y-f.width*a.height/a.width/2;
        const p=M.worldToScreen(rect,x,centreY);
        if (opacity>.35 && scene.isSky(p.x,p.y,life.w,life.h))
          this.target(life,rect,f.id,f.name,x,centreY,f.width/2,
            []);
      }
    }
  }
  window.photoVisitors=new PhotoVisitors();
})();
