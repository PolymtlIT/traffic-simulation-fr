
const userCanDropObjects=false;


/*#########################################################
 game callbacks (general callbacks for all games in control_gui.js)
#########################################################*/

// game starts with empty roads

function updateRoutingGame(time){ // game inflow
    qIn=(time<50) ? 3000/3600 : 
	(time<90) ? 600/3600 : 
	(time<120) ? 3300/3600 :
	(time<125) ? 900/3600 : 0;
    slider_qIn.value=3600*qIn;
    slider_qInVal.innerHTML=Math.round(3600*qIn)+" Fz/h";
}


var nick="Voldemort";
function playRoutingGame(infotextID){ // e.g.,  playRoutingGame("infotext");
  isGame=true;
  time=0;
  itime=0;
  var nregular=mainroad.nRegularVehs();
  mainroad.removeRegularVehs();
  ramp.removeRegularVehs();
  nick = prompt("Please enter your nick", "Voldemort");
  var debug=false;
  if(debug){
    time=1000*Math.random(); // gets score in finish...
    finishRoutingGame("infotextRoutingGame");
  }

}


function finishRoutingGame(infotextID){
    isGame=false;
    qIn=qInInit;
    var roundedTime=parseFloat(time).toFixed(1);
    var messageText=updateHighscores(nick,roundedTime,
				     "routingGame_Highscores");
    document.getElementById(infotextID).innerHTML=messageText;
    console.log("Game finished in ",time," seconds!");
    myStartStopFunction(); // reset game
}

function clearHighscores_routingGame(){
  deleteHighscores("routingGame_Highscores");
  time=10000;
  nick="The Worst Controller"
  finishRoutingGame("infotextRoutingGame");
}
  

//#############################################################
// adapt standard param settings from control_gui.js
//#############################################################


// further routing game controls in control_gui.js


var isGame=false;
var qInInit=2200./3600;

// override standard settings in control_gui.js

qIn=qInInit;
setSlider(slider_qIn, slider_qInVal, 3600*qIn, 0, "veh/h");
//slider_qIn.value=3600*qIn;
//slider_qInVal.innerHTML=3600*qIn+" Fz/h";


fracTruck=0.15;

IDM_a=0.9; 

MOBIL_bBiasRight_car=0.0
MOBIL_bBiasRight_truck=5.0
MOBIL_bThr=0.0


MOBIL_mandat_bSafe=15; // standard 42
MOBIL_mandat_bThr=0;   
MOBIL_mandat_bias=10;

// behavior during bottlenecks (car and trucks) reduced v0 etc
// distributed over the vehicles in ramp.setCFModelsInRange

var longModelBottl=new ACC(0.2*IDM_v0,8*IDM_T,1*IDM_s0,2*IDM_a,0.5*IDM_b); 
updateModels(); 


/*######################################################
 Global overall scenario settings and graphics objects
 see onramp.js for more details

 refSizePhys  => reference size in m (generally smaller side of canvas)
 refSizePix   => reference size in pixel (generally smaller side of canvas)
 scale = refSizePix/refSizePhys 
       => roads have full canvas regardless of refSizePhys, refSizePix

 (1) refSizePix=Math.min(canvas.width, canvas.height) determined during run  

 (2) refSizePhys smaller  => all phys roadlengths smaller
  => vehicles and road widths appear bigger for a given screen size 
  => chose smaller for mobile, 

######################################################*
*/

var scenarioString="Deviation";
console.log("\n\nstart main: scenarioString=",scenarioString);

var simDivWindow=document.getElementById("contents");
var canvas = document.getElementById("canvas"); 
var ctx = canvas.getContext("2d"); // graphics context
canvas.width  = simDivWindow.clientWidth; 
canvas.height  = simDivWindow.clientHeight;
var aspectRatio=canvas.width/canvas.height;


console.log("before addTouchListeners()");
addTouchListeners();
console.log("after addTouchListeners()");


//##################################################################
// overall scaling (critAspectRatio should be consistent with 
// width/height in css.#contents)
//##################################################################

var isSmartphone=mqSmartphone();

var refSizePhys=320;  // constants => all objects scale with refSizePix
                      // also adapt in updateDimensions

var critAspectRatio=1.7; // from css file width/height of #contents
                         // the higher, the longer sim window
                         // must be the same as in css:
                         // max-aspect-ratio: 17/10 etc

var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);
var scale=refSizePix/refSizePhys;


//##################################################################
// Specification of physical road geometry and vehicle properties
// If refSizePhys changes, change them all => updateDimensions();
//##################################################################

// all relative "Rel" settings with respect to refSizePhys, not refSizePix!

var center_xRel=0.43;
var center_yRel=-0.5;
var arcRadiusRel=0.39;
var offLenRel=0.9;

var center_xPhys=center_xRel*refSizePhys; //[m]
var center_yPhys=center_yRel*refSizePhys;

var arcRadius=arcRadiusRel*refSizePhys;
var arcLen=arcRadius*Math.PI;
var straightLen=refSizePhys*critAspectRatio-center_xPhys;
var mainroadLen=arcLen+2*straightLen;


// geometry of deviation road

var laneWidth=7;  // needed to define deviation geometry 
var laneWidthRamp=5;
var nLanes_main=2;
var nLanes_rmp=1;

var umainDiverge=0.65*straightLen-0.15*arcLen; // main coord where diverge zone ends
var rDev=0.1*refSizePhys;        // radius of curves on deviation route
var alpha=0.2*Math.PI;           // heading change of first right-curve
var lrampDev=0.5*refSizePhys;    // length of off/onramp section of deviation
var taperLen=0.05*refSizePhys;   // for both merge/diverge parts
var lParallel=0.2*refSizePhys;   // length parallel to mainroad before merg.

// length of deviation

var lDev=2*(lrampDev+arcRadius)+laneWidth*(nLanes_main+1)+lParallel
    +rDev*(4*alpha+Math.PI+2-4*Math.cos(alpha)); 

// difference between first diverge and first merge point in mainroad coords

var dumainDivergeMerge=arcLen-lrampDev
    +lParallel+ 2*(straightLen-umainDiverge);

// first merging point in mainroad coordinates

var umainMerge=umainDiverge+dumainDivergeMerge;

// region of flow-conserving bottleneck to create jams on deviations 

var udevBottlBeg=lDev-lrampDev-rDev*(2*alpha+Math.PI)-lParallel;
//var udevBottlBeg=lrampDev;
var udevBottlEnd=lDev-lrampDev;


console.log(" deviation properties: length lDev=",lDev,
	    " dumainDivergeMerge=",dumainDivergeMerge,
	    " umainDiverge=",umainDiverge,
	    " umainMerge=",umainMerge);
console.log("lDev=",lDev,
	    " udevBottlBeg=",udevBottlBeg,
	    " udevBottlEnd=",udevBottlEnd);


// roadworks properties (mainroad coordinates)

var uBeginRoadworks=straightLen+0.9*arcLen;
var uEndRoadworks=uBeginRoadworks+0.2*arcLen;



function updateDimensions(){ // if viewport or sizePhys changed (mobile)
    center_xPhys=center_xRel*refSizePhys;
    center_yPhys=center_yRel*refSizePhys;

    arcRadius=arcRadiusRel*refSizePhys;
    arcLen=arcRadius*Math.PI;
    straightLen=refSizePhys*critAspectRatio-center_xPhys;
    mainroadLen=arcLen+2*straightLen;

    umainDiverge=0.65*straightLen-0.15*arcLen; 
    rDev=0.1*refSizePhys;        // radius of curves on deviation route
    alpha=0.2*Math.PI;           // heading change of first right-curve
    lrampDev=0.5*refSizePhys;    // length of off/onramp section of deviation
    taperLen=0.05*refSizePhys;   // for both merge/diverge parts
    lParallel=0.2*refSizePhys;   // length parallel to mainroad before merg.

    lDev=2*(lrampDev+arcRadius)+laneWidth*(nLanes_main+1)+lParallel
    +rDev*(4*alpha+Math.PI+2-4*Math.cos(alpha)); 

    dumainDivergeMerge=arcLen-lrampDev
    +lParallel+ 2*(straightLen-umainDiverge);
    umainMerge=umainDiverge+dumainDivergeMerge;

    // if viewport or sizePhys changed, init sttings above in var def
    udevBottlBeg=lDev-lrampDev-rDev*(2*alpha+0.5*Math.PI)-lParallel;
    udevBottlEnd=lDev-lrampDev;
    uBeginRoadworks=straightLen+0.9*arcLen;
    uEndRoadworks=uBeginRoadworks+0.2*arcLen;
}



// the following remains constant 
// => road becomes more compact for smaller screens

var car_length=7; // car length in m
var car_width=5; // car width in m
var truck_length=15; // trucks
var truck_width=7; 
var laneRoadwork=0;  // 0=left, nLanes_main-1=right // also setLCMandat chg!!
var lenRoadworkElement=10;




//###############################################################
// physical (m) road
//###############################################################


function traj_x(u){ // physical coordinates
        var dxPhysFromCenter= // left side (median), phys coordinates
	    (u<straightLen) ? straightLen-u
	  : (u>straightLen+arcLen) ? u-mainroadLen+straightLen
	  : -arcRadius*Math.sin((u-straightLen)/arcRadius);
	return center_xPhys+dxPhysFromCenter;
}

function traj_y(u){ // physical coordinates
        var dyPhysFromCenter=
 	    (u<straightLen) ? arcRadius
	  : (u>straightLen+arcLen) ? -arcRadius
	  : arcRadius*Math.cos((u-straightLen)/arcRadius);
	return center_yPhys+dyPhysFromCenter;
}

function trajRamp_x(u){ // physical coordinates
    var calpha=Math.cos(alpha);
    var salpha=Math.sin(alpha);

    var u1=lrampDev; // end of diverg. section
    var x1=traj_x(u1+umainDiverge);
    var y1=traj_y(u1)+0.5*laneWidth*(nLanes_main+1); // nLanes_main: main; nLanes_mainDev=1

    var u2=u1+rDev*alpha;  //  end first right-curve, begin left curve
    var x2=x1-rDev*salpha;
    var y2=y1+rDev*(1-calpha);

    var u3=u2+rDev*(0.5*Math.PI+alpha); // begin first straight sect perp main
    var x3=x2-rDev*(1+salpha);
    var y3=y2-rDev*calpha;


    var u4=u3+2*(arcRadius+y3-y1)+laneWidth*(nLanes_main+1); // end 1st straight
    var x4=x3;

    var u5=u4+rDev*0.5*Math.PI; // begin second straight sect parall main
    var x5=x4+rDev;

    var u6=u5+lParallel; // end second straight sect parall main
    var x6=x5+lParallel;

    var u7=u6+rDev*alpha; // end last left curve-begin last right curve
    var x7=x6+rDev*salpha;

    var u8=u7+rDev*alpha; // begin merge
    var x8=2*x7-x6;

    var u9=u8+lrampDev; // end merge=end deviation
    var x9=x8+lrampDev;

    return (u<u1) ? x1+u1-u
	: (u<u2) ? x1-rDev*Math.sin((u-u1)/rDev)
	: (u<u3) ? x3+rDev*(1-Math.cos((u3-u)/rDev))
	: (u<u4) ? x3 
	: (u<u5) ? x4+rDev*(1-Math.cos((u-u4)/rDev))
	: (u<u6) ? x5+(u-u5)
	: (u<u7) ? x6 + rDev*Math.sin((u-u6)/rDev)
	: (u<u8) ? x8 - rDev*Math.sin((u8-u)/rDev) : x8+(u-u8);
}


function trajRamp_y(u){ // physical coordinates
    var calpha=Math.cos(alpha);
    var salpha=Math.sin(alpha);

    var u1=lrampDev; // end of diverg. section
    var y1=traj_y(u1)+0.5*laneWidth*(nLanes_main+1); // nLanes_main: main; nLanes_mainDev=1

    var u2=u1+rDev*alpha;  //  end first right-curve, begin left curve
    var y2=y1+rDev*(1-calpha);

    var u3=u2+rDev*(0.5*Math.PI+alpha); // begin first straight sect perp main
    var y3=y2-rDev*calpha;

    var u4=u3+2*(arcRadius+y3-y1)+laneWidth*(nLanes_main+1); // end 1st straight
    var y4=y3+u3-u4;

    var u5=u4+rDev*0.5*Math.PI; // begin second straight sect parall main
    var y5=y4-rDev;

    var u6=u5+lParallel; // end second straight sect parall main
    var y6=y5;

    var u7=u6+rDev*alpha; // end last left curve-begin last right curve
    var y7=y6+rDev*(1-calpha);

    var u8=u7+rDev*alpha; // begin merge
    var y8=2*y7-y6;

    var u9=u8+lrampDev; // end merge=end deviation
    var y9=y8;


    return (u<taperLen) ? y1-0.6*laneWidth*(1-u/taperLen)
        : (u<u1) ? y1
	: (u<u2) ? y1+rDev*(1-Math.cos((u-u1)/rDev))
	: (u<u3) ? y3+rDev*Math.sin((u3-u)/rDev)
	: (u<u4) ? y3-(u-u3)
	: (u<u5) ? y4-rDev*Math.sin((u-u4)/rDev)
	: (u<u6) ? y5
	: (u<u7) ? y6 + rDev*(1-Math.cos((u-u6)/rDev))
	: (u<u8) ? y8 - rDev*(1-Math.cos((u8-u)/rDev))
        : (u<u8+lrampDev-taperLen) ? y8 
	: y8+0.6*laneWidth*((u-u8-lrampDev+taperLen)/taperLen)
}




//##################################################################
// Specification of logical road network
//##################################################################


var speedInit=20; // m/s
var density=0.001;
var fracTruckToleratedMismatch=1.0; // 100% allowed=>changes only by sources

var isRing=false; 
duTactical=300; // anticipation distance for applying mandatory LC rules

var mainroad=new road(1,mainroadLen,laneWidth,nLanes_main,
		      [traj_x,traj_y],
		      density,speedInit,fracTruck,isRing);
var ramp=new road(2,lDev,laneWidthRamp,nLanes_rmp,
		  [trajRamp_x,trajRamp_y],
		       0.1*density,speedInit,fracTruck,isRing);
network[0]=mainroad;  // network declared in canvas_gui.js
network[1]=ramp;


var offrampIDs=[2];
var offrampLastExits=[umainDiverge+lrampDev];
var offrampToRight=[true];
mainroad.setOfframpInfo(offrampIDs,offrampLastExits,offrampToRight);
mainroad.duTactical=duTactical;


//############################################
// define routes
//############################################

var route1=[1];  // stays on mainroad
var route2=[1,2]; // takes deviation
for (var i=0; i<mainroad.veh.length; i++){
    mainroad.veh[i].route=(Math.random()<fracOff) ? route2 : route1;
    //console.log("mainroad.veh["+i+"].route="+mainroad.veh[i].route);
}


// add standing virtual vehicle at the end of onramp (1 lane)

var virtualStandingVeh=new vehicle(2, laneWidth, lDev-0.6*taperLen, 0, 0, "obstacle");

ramp.veh.unshift(virtualStandingVeh); // prepending=unshift

// add standing virtual vehicles at position of road works 
// (nr=number of virtual "roadwork" Fzicles)

var nr=Math.round((uEndRoadworks-uBeginRoadworks)/lenRoadworkElement);

for (var ir=0; ir<nr; ir++){
    var u=uBeginRoadworks+(ir+0.5)*lenRoadworkElement;
    var virtualStandingVehRoadw=new vehicle(lenRoadworkElement, laneWidth, 
					u,laneRoadwork, 0, "obstacle");
    mainroad.veh.push(virtualStandingVehRoadw); // append; prepend=unshift
}

// put roadwork obstacles at right place and let vehicles get context of them 

mainroad.sortVehicles();
mainroad.updateEnvironment();



//#########################################################
// model initialization (models and methods defined in control_gui.js)
//#########################################################
	
updateModels(); // defines longModelCar,-Truck,LCModelCar,-Truck,-Mandatory


//####################################################################
// Global graphics specification and image file settings
//####################################################################

var hasChanged=true; // window dimensions have changed (responsive design)

var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn
var userCanvasManip; // true only if user-driven geometry changes

var drawColormap=false;
var vmin_col=0; // min speed for speed colormap (drawn in red)
var vmax_col=100/3.6; // max speed for speed colormap (drawn in blue-violet)


//#########################################################
// The images
//#########################################################


// init background image

var background = new Image();
background.src ='figs/backgroundGrass.jpg'; 
 

// init vehicle image(s)

carImg = new Image();
carImg.src = 'figs/blackCarCropped.gif';
truckImg = new Image();
truckImg.src = 'figs/truck1Small.png';


// init traffic light images

traffLightRedImg = new Image();
traffLightRedImg.src='figs/trafficLightRed_affine.png';
traffLightGreenImg = new Image();
traffLightGreenImg.src='figs/trafficLightGreen_affine.png';


// define obstacle images

obstacleImgNames = []; // srcFiles[0]='figs/obstacleImg.png'
obstacleImgs = []; // srcFiles[0]='figs/obstacleImg.png'
for (var i=0; i<10; i++){
  obstacleImgs[i]=new Image();
  obstacleImgs[i].src = (i==0)
    ? "figs/obstacleImg.png"
    : "figs/constructionVeh"+(i)+".png";
  obstacleImgNames[i] = obstacleImgs[i].src;
}


// init road images

roadImgs1 = []; // road with lane separating line
roadImgs2 = []; // road without lane separating line

for (var i=0; i<4; i++){
    roadImgs1[i]=new Image();
    roadImgs1[i].src="figs/road"+(i+1)+"lanesCropWith.png"
    roadImgs2[i]=new Image();
    roadImgs2[i].src="figs/road"+(i+1)+"lanesCropWithout.png"
}

roadImg1 = new Image();
roadImg1=roadImgs1[nLanes_main-1];
roadImg2 = new Image();
roadImg2=roadImgs2[nLanes_main-1];

rampImg = new Image();
rampImg=roadImgs1[nLanes_rmp-1];


//############################################
// traffic objects
//############################################

// TrafficObjects(canvas,nTL,nLimit,xRelDepot,yRelDepot,nRow,nCol)
var trafficObjs=new TrafficObjects(canvas,2,2,0.60,0.50,0,0);//0,0=>nix
var trafficLightControl=new TrafficLightControlEditor(trafficObjs,0.5,0.5);


//############################################
// run-time specification and functions
//############################################

var time=0;
var itime=0;
var fps=30; // frames per second
var dt=timewarp/fps;




//#################################################################
function updateSim(){
//#################################################################

    // update times and general settings

  time +=dt; // dt depends on timewarp slider (fps=const)
  itime++;

  if(isGame){
	updateRoutingGame(time);  // from control_gui.js
	if(false){
	    console.log("in game: time=",time," qIn=",qIn,
		    " mainroad: ",mainroad.nRegularVehs(),"vehicles",
		    " deviation: ",ramp.nRegularVehs(),"vehicles");
	}

	if((mainroad.nRegularVehs()==0)&&(ramp.nRegularVehs()<=1)
	   &&(time>30)){ // last cond necessary since initially regular vehs
	    finishRoutingGame("infotextRoutingGame");
	}

  }


    // (2) transfer effects from slider interaction and mandatory regions
    // to the vehicles and models: 

    //console.log("\n(0)");
    //mainroad.writeVehicleRoutes(umainDiverge+lrampDev-1.2*duTactical,umainDiverge+lrampDev);//!!!

    // updateModelsOfAllVehicles also selectively sets LCModelMandatory
    // to offramp vehs based on their routes!

    mainroad.updateTruckFrac(fracTruck, fracTruckToleratedMismatch);
    mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck,
				       LCModelMandatory);
  // (2a) update moveable speed limits

  for(var i=0; i<network.length; i++){
    network[i].updateSpeedlimits(trafficObjs);
  }


    // (2b) implement strong urge to change lanes before roadworks
    // (umin,umax,toRight) !for all vehs in contrast to route based offramp
 

    mainroad.setLCMandatory(uBeginRoadworks-0.5*arcLen, uBeginRoadworks, 
			    true);

    ramp.updateTruckFrac(fracTruck, fracTruckToleratedMismatch);
    ramp.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				      LCModelCar,LCModelTruck,
				       LCModelMandatory);


    // implement flow-conserving bottleneck 
    // arg list: (umin,umax, CFModelCar,CFModelTruck)
    
    ramp.setCFModelsInRange(udevBottlBeg,udevBottlEnd,
				 longModelBottl,longModelBottl);

    // externally impose mandatory LC behaviour
    // all deviation vehicles must change lanes to the left (last arg=false)
    ramp.setLCMandatory(lDev-lrampDev, lDev, false);



    // do central simulation update of vehicles

    mainroad.updateLastLCtimes(dt);
    mainroad.calcAccelerations();  
    mainroad.changeLanes();         
    mainroad.updateSpeedPositions();
    mainroad.updateBCdown();
    var route=(Math.random()<fracOff) ? route2 : route1;
    mainroad.updateBCup(qIn,dt,route); // qIn=total inflow, route opt. arg.


    ramp.updateLastLCtimes(dt); // needed since LC from main road!!
    ramp.calcAccelerations();  
    ramp.updateSpeedPositions();
    ramp.updateBCdown();

    var du_antic=20; //shift anticipation decision point upstream by du_antic

     //template: mergeDiverge(newRoad,offset,uStart,uEnd,isMerge,toRight)


    mainroad.mergeDiverge(ramp,-umainDiverge,
			  umainDiverge+taperLen,
			  umainDiverge+lrampDev-du_antic,
			  false,true);
    ramp.mergeDiverge(mainroad, umainMerge-(ramp.roadLen-lrampDev),
			   ramp.roadLen-lrampDev, 
			   ramp.roadLen-taperLen, 
			   true,false);
 


    //logging

    //ramp.writeVehiclesSimple();

    if(false){
        console.log("\nafter updateSim: itime="+itime+" ramp.nveh="+ramp.veh.length);
	for(var i=0; i<ramp.veh.length; i++){
	    console.log("i="+i+" ramp.veh[i].u="+ramp.veh[i].u
			+" ramp.veh[i].v="+ramp.veh[i].v
			+" ramp.veh[i].lane="+ramp.veh[i].lane
			+" ramp.veh[i].laneOld="+ramp.veh[i].laneOld);
	}
 	console.log("\n");
    }



}//updateSim




//##################################################
function drawSim() {
//##################################################


    /* (0) redefine graphical aspects of road (arc radius etc) using
     responsive design if canvas has been resized 
     */

    var relTextsize_vmin=(isSmartphone) ? 0.03 : 0.02; //xxx
    var textsize=relTextsize_vmin*Math.min(canvas.width,canvas.height);
   
    if(false){
        console.log(" new total inner window dimension: ",
		window.innerWidth," X ",window.innerHeight,
		" (full hd 16:9 e.g., 1120:630)",
		" canvas: ",canvas.width," X ",canvas.height);
    }


    if ((canvas.width!=simDivWindow.clientWidth)
	||(canvas.height != simDivWindow.clientHeight)){
	hasChanged=true;
	canvas.width  = simDivWindow.clientWidth;
        canvas.height  = simDivWindow.clientHeight;
	aspectRatio=canvas.width/canvas.height;
	refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);

	scale=refSizePix/refSizePhys; // refSizePhys=constant unless mobile

      updateDimensions();
     }

 
    // (1) update heading of all vehicles rel. to road axis
    // (for some reason, strange rotations at beginning)

    

    // (2) reset transform matrix and draw background
    // (only needed if no explicit road drawn)
    // "%20-or condition"
    //  because some older firefoxes do not start up properly?

    ctx.setTransform(1,0,0,1,0,0); 
    if(drawBackground){
	if(userCanvasManip ||hasChanged
	   ||(itime<=1) || (itime===20) || false || (!drawRoad)){
	  ctx.drawImage(background,0,0,canvas.width,canvas.height);
      }
    }


    // (3) draw mainroad and ramps (deviation "bridge" => draw last)
    // and vehicles (directly after frawing resp road or separately, depends)
    // (always drawn; changedGeometry only triggers building a new lookup table)
    //!!! sometimes road elements are moved as though they were vehicles
    // check/debug with omitting drawing of the road (changedGeometry=false)!
    
    var changedGeometry=userCanvasManip || hasChanged||(itime<=1); 
    //var changedGeometry=false; 

    ramp.draw(rampImg,rampImg,scale,changedGeometry);
    ramp.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col);

    mainroad.draw(roadImg1,roadImg2,scale,changedGeometry);

    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col);

    // redraw first/last deviation vehicles obscured by mainroad drawing
 
    ramp.drawVehicles(carImg,truckImg,obstacleImgs,scale,
			  vmin_col,vmax_col,0,lrampDev);
    ramp.drawVehicles(carImg,truckImg,obstacleImgs,scale,
			   vmin_col,vmax_col,lDev-lrampDev, lDev);

  // (5a) draw traffic objects 

  if(userCanDropObjects&&(!isSmartphone)){
    trafficObjs.draw(scale);
  }

  // (5b) draw speedlimit-change select box

  ctx.setTransform(1,0,0,1,0,0); 
  drawSpeedlBox();


    
    // (6) draw simulated time

    displayTime(time,textsize);


     // (7) draw the speed colormap

    if(drawColormap){ 
	displayColormap(0.22*refSizePix,
			0.43*refSizePix,
			0.1*refSizePix, 0.2*refSizePix,
			vmin_col,vmax_col,0,100/3.6);
    }

  // may be set to true in next step if changed canvas 
  // or old sign should be wiped away 
  hasChanged=false;


  // revert to neutral transformation at the end!
  ctx.setTransform(1,0,0,1,0,0); 

}// drawSim
 

 //##################################################
// Running function of the sim thread (triggered by setInterval)
//##################################################

function main_loop() {
    updateSim();
    drawSim();
    userCanvasManip=false;
}
 
function myGameRestartFunction(){
  document.getElementById("infotextRoutingGame").innerHTML=infoString;
  myRestartFunction();
}



 //############################################
// start the simulation thread
// THIS function does all the things; everything else 
// only functions/definitions
// triggers:
// (i) automatically when loading the simulation 
// (ii) when pressing the start button 
//  ("myRun=setInterval(main_loop, 1000/fps);")
//############################################

console.log("first main execution");


// var infoString defined in routingGameInfo.js

document.getElementById("infotextRoutingGame").innerHTML=infoString;

var myRun=setInterval(main_loop, 1000/fps);



 

 

