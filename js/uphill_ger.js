
const userCanDropObjects=true;

//#############################################################
// override standard param settings from control_gui.js
//#############################################################


density=0.;
    

fracTruck=0.25; //  0.25
setSlider(slider_fracTruck, slider_fracTruckVal, 100*fracTruck, 0, "%");

timewarp=5; //  default 6 in control_gui.js
setSlider(slider_timewarp, slider_timewarpVal, timewarp, 0, "-fach");

qIn=2500./3600; //2500./3600;
setSlider(slider_qIn, slider_qInVal, 3600*qIn, 0, "veh/h");

IDM_a=1.5; // high to allow passing cars if truck overtaking ban active
setSlider(slider_IDM_a, slider_IDM_aVal, IDM_a, 1, "m/s<sup>2</sup>");

factor_a_truck=2; // to allow faster slowing down of the uphill trucks


IDM_v0Up=30/3.6
setSlider(slider_IDM_v0Up, slider_IDM_v0UpVal, 3.6*IDM_v0Up, 0, "km/h");


MOBIL_bBiasRight_car=-0.1; //-0.1
setSlider(slider_MOBIL_bBiasRight_car, slider_MOBIL_bBiasRight_carVal, 
	  MOBIL_bBiasRight_car, 1, "m/s<sup>2</sup>");

MOBIL_bBiasRight_truck=0.1; //0.1
setSlider(slider_MOBIL_bBiasRight_truck, slider_MOBIL_bBiasRight_truckVal, 
	  MOBIL_bBiasRight_truck, 1, "m/s<sup>2</sup>");

MOBIL_bSafe=4;   // bSafe if v to v0  (threshold, bias in sliders)
MOBIL_bSafeMax=16;  // bSafe if v to 0 //!! use it
MOBIL_bThr=0.1;
MOBIL_mandat_bSafe=6;
MOBIL_mandat_bSafeMax=20;



/*######################################################
 Global overall scenario settings and graphics objects
 => see onramp.js for more details
 => actual drawing dynamic variables (such as drawBackground) 
    see Global graphics specification section

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

var scenarioString="Uphill";
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

var refSizePhys=(isSmartphone) ? 130 : 200;  // constants

var critAspectRatio=120./95.; // from css file width/height of #contents

var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);
var scale=refSizePix/refSizePhys;


//##################################################################
// Specification of physical road geometry and vehicle properties
// If refSizePhys changes, change them all => updateDimensions();
//##################################################################


var center_xRel=0.43;
var center_yRel=-0.55;
var arcRadiusRel=0.35;
var offLenRel=0.9;

var center_xPhys=center_xRel*refSizePhys; //[m] DOS for shifting w/resp
                                          // to viewport; redefine
                                          // traj_x(u) for that
var center_yPhys=center_yRel*refSizePhys;

var arcRadius=arcRadiusRel*refSizePhys;
var arcLen=arcRadius*Math.PI;
var straightLen=refSizePhys*critAspectRatio-center_xPhys;
var mainroadLen=arcLen+2*straightLen;
var uBeginBanRel=0.1; //MT jun2019
var uminLC=uBeginBanRel*straightLen+1; // !!!pass to mainroad.uminLC once def.
var uBeginBan=uBeginBanRel*straightLen; // truck overtaking ban if clicked active
var uBeginUp=straightLen+0.3*arcLen;
var uEndUp=straightLen+1.3*arcLen;


function updateDimensions(){ // if viewport or sizePhys changed
    center_xPhys=center_xRel*refSizePhys; //[m]
    center_yPhys=center_yRel*refSizePhys;

    arcRadius=arcRadiusRel*refSizePhys;
    arcLen=arcRadius*Math.PI;
    straightLen=refSizePhys*critAspectRatio-center_xPhys;
    mainroadLen=arcLen+2*straightLen;

    uBeginBan=uBeginBanRel*straightLen; // truck overtaking ban if clicked active
    uBeginUp=straightLen+0.3*arcLen;
    uEndUp=straightLen+1.3*arcLen;
}



// the following remains constant 
// => road becomes more compact for smaller screens

var car_length=7; // car length in m
var car_width=5; // car width in m
var truck_length=12; // trucks
var truck_width=7; 

var nLanes_main=2;
var laneWidth=7;



// on constructing road, road elements are gridded and interna
// road.traj_xy(u) are generated. Then, main.traj_xy*(u) obsolete


function traj_x(u){ // physical coordinates
    var dxPhysFromCenter= // left side (median), phys coordinates
	(u<straightLen) ? straightLen-u
	: (u>straightLen+arcLen) ? u-mainroadLen+straightLen
	: -arcRadius*Math.sin((u-straightLen)/arcRadius);
    //dxPhysFromCenter -=10; // !!! activate if testing inflow
    return center_xPhys+dxPhysFromCenter;
}

function traj_y(u){ // physical coordinates
        var dyPhysFromCenter=
 	    (u<straightLen) ? arcRadius
	  : (u>straightLen+arcLen) ? -arcRadius
	  : arcRadius*Math.cos((u-straightLen)/arcRadius);
	return center_yPhys+dyPhysFromCenter;
}



//##################################################################
// Specification of logical road network
//##################################################################


// uphill property only in sim run by setLCModelsInRange => changes models
// for all veh between umin and umax

var isRing=false;  // 0: false; 1: true
var roadID=1;
var speedInit=20; // IC for speed
var fracTruckToleratedMismatch=1.0; // 100% allowed=>changes only by sources

var speedInit=20; // m/s

var mainroad=new road(roadID,mainroadLen,laneWidth,nLanes_main,
		      [traj_x,traj_y],
		      density, speedInit,fracTruck, isRing);

network[0]=mainroad;  // network declared in canvas_gui.js


mainroad.uminLC=uminLC;


//#########################################################
// model initialization (models and methods defined in control_gui.js)
//#########################################################
	
updateModels(); // defines longModelCar,-Truck,LCModelCar,-Truck,-Mandatory
updateModelsUphill(); // defines [long|LC]Model[Car|Truck]uphill


//####################################################################
// Global graphics specification 
//####################################################################


var hasChanged=true; // window dimensions have changed (responsive design)

var drawBackground=true; // if false, default unicolor background
var backgroundJustDrawn=false; //MT 2020-01 controls redrawing of signs etc
var drawRoad=true; // if false, only vehicles are drawn
var userCanvasManip; // true only if user-driven geometry changes finished

var drawColormap=false; // now drawn as png from html 
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


// define obstacle image names

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


//speedlimit images 

var speedL_srcFileIndexOld=8; //  start with index8 = 80 km/h
var speedL_srcFileIndex=8;
var speedL_srcFiles = [];
for (var i=0; i<13; i++){
    speedL_srcFiles[i]="figs/Tempo"+i+"0.png";
}
speedL_srcFiles[13]='figs/sign_free_282_small.png'; 
var speedlimitImgs = [];
for (var i=0; i<=13; i++){
    speedlimitImgs[i]=new Image();
    speedlimitImgs[i].src=speedL_srcFiles[i];
}
var speedlimitImg=speedlimitImgs[speedL_srcFileIndex];



//uphill-related sign images 

var signUphillImg = new Image();
    signUphillImg.src ='figs/Zeichen_Steigung4_small.png';

var signFreeImg = new Image();
    signFreeImg.src ='figs/sign_free_282_small.png'; 

var signTruckOvertakingBan = new Image();
    signTruckOvertakingBan.src ='figs/truckOvertakingBan_small.gif'; 



//############################################
// traffic objects
//############################################


// TrafficObjects(canvas,nTL,nLimit,xRelDepot,yRelDepot,nRow,nCol)
var trafficObjs=new TrafficObjects(canvas,0,2,0.60,0.50,1,2);
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


  // (1) update times

  time +=dt; // dt depends on timewarp slider (fps=const)
  itime++;
  isSmartphone=mqSmartphone();

  // (2) transfer effects from slider interaction and mandatory regions
  // to the vehicles and models

  mainroad.updateTruckFrac(fracTruck, fracTruckToleratedMismatch);
  mainroad.updateModelsOfAllVehicles(longModelCar,longModelTruck,
				       LCModelCar,LCModelTruck,
				       LCModelMandatory);

  // transfer slider actions to Uphill LC models if no ban
  // (fixed models if ban)
  // actual transfer to the vehicles in mainroad.setLCModelsInRange 
  
  updateModelsUphill();
  
  if(false){
  //if(itime%20==0){
    console.log("\nLCModelCarUphill.bBiasRight=",LCModelCarUphill.bBiasRight,
		" LCModelCar.bBiasRight=",LCModelCar.bBiasRight);
    console.log("LCModelTruckUphill.bBiasRight=",LCModelTruckUphill.bBiasRight,
		" LCModelTruck.bBiasRight=",LCModelTruck.bBiasRight);
  }
    mainroad.setCFModelsInRange(uBeginUp,uEndUp,
				 longModelCarUphill,longModelTruckUphill);
    mainroad.setLCModelsInRange(uBeginBan,uEndUp,
				 LCModelCarUphill,LCModelTruckUphill);

  // (2a) update moveable speed limits

  for(var i=0; i<network.length; i++){
    network[i].updateSpeedlimits(trafficObjs);
  }

    // do central simulation update of vehicles

    mainroad.updateLastLCtimes(dt);
    mainroad.calcAccelerations();  
    mainroad.changeLanes();         
    mainroad.updateSpeedPositions();
    mainroad.updateBCdown();
    mainroad.updateBCup(qIn,dt); // argument=total inflow
	

    if(true){
	for (var i=0; i<mainroad.nveh; i++){
	    if(mainroad.veh[i].speed<0){
		console.log(" speed "+mainroad.veh[i].speed
			    +" of mainroad vehicle "
			    +i+" is negative!");
	    }
	}
    }


   if(userCanDropObjects&&(!isSmartphone)&&(!trafficObjPicked)){
    trafficObjs.zoomBack();
  }

  // (6) debug output
  
  if(false){
  //if(itime%20==0){
    //mainroad.writeTrucksLC();
    mainroad.writeVehicleLCModels();
  }

  
}//updateSim




//##################################################
function drawSim() {
//##################################################


    // (0) redefine graphical aspects of road (arc radius etc) using
    // responsive design if canvas has been resized 
    // isSmartphone defined in updateSim
 
    var relTextsize_vmin=(isSmartphone) ? 0.03 : 0.02; //xxx
    var textsize=relTextsize_vmin*Math.min(canvas.width,canvas.height);



    if ((canvas.width!=simDivWindow.clientWidth)
	||(canvas.height != simDivWindow.clientHeight)){
	hasChanged=true;
	canvas.width  = simDivWindow.clientWidth;
        canvas.height  = simDivWindow.clientHeight;
	aspectRatio=canvas.width/canvas.height;
	refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);

	scale=refSizePix/refSizePhys; // refSizePhys=constant unless mobile

      updateDimensions();
      trafficObjs.calcDepotPositions(canvas); 

	if(true){
	    console.log("haschanged=true: new canvas dimension: ",
		        canvas.width," X ",canvas.height);
	}


    }

 
    // (1) update heading of all vehicles rel. to road axis
    // (for some reason, strange rotations at beginning)

    
  // (2) reset transform matrix and draw background
  // (only needed if changes, or something needs to be wiped off
  // (overtaking ban) plus "reminders" for lazy browsers

  ctx.setTransform(1,0,0,1,0,0);
  if(drawBackground){
    if(hasChanged||(itime<=10) || (itime%50==0) || userCanvasManip
      || (!drawRoad) || banButtonClicked){
      ctx.drawImage(background,0,0,canvas.width,canvas.height);
      backgroundJustDrawn=true; // MT 2020-01
      
    }
  }

  // MT 2020 need to reset here because drawBackground condition needs
  // banButtonClicked state from previous step to wipe out lifted ban

  banButtonClicked=false;


    // (3) draw mainroad
    // (always drawn; but changedGeometry=true necessary
    // if changed (it triggers building a new lookup table). 
    // Otherwise, road drawn at old position

    
  var changedGeometry=userCanvasManip || hasChanged||(itime<=1);
  mainroad.draw(roadImg1,roadImg2,scale,changedGeometry);


 
  // (4) draw vehicles (obstacleImg here empty, only needed for interface)

  mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,vmin_col,vmax_col);

  // (4a) draw traffic signs (banButtonClicked => control_gui.js) MT 2020-01
  //console.log("banButtonClicked=",banButtonClicked," banIsActive=",banIsActive);

  if(backgroundJustDrawn||banButtonClicked){ // MT 2020-01
 
    var sizeSignPix=0.1*refSizePix;
    var vOffset=1.4*nLanes_main*laneWidth; // in v direction, pos if right

    var xPixUp=mainroad.get_xPix(uBeginUp,vOffset,scale);
    var yPixUp=mainroad.get_yPix(uBeginUp,vOffset,scale);
    var xPixEnd=mainroad.get_xPix(uEndUp,vOffset,scale);
    var yPixEnd=mainroad.get_yPix(uEndUp,vOffset,scale);
    var xPixBan=mainroad.get_xPix(uBeginBan+0.1*straightLen,-0.5*vOffset,scale);
    var yPixBan=mainroad.get_yPix(uBeginBan+0.1*straightLen,-0.5*vOffset,scale);

        // center sign (the drawing coords denote the left upper corner)

    xPixUp -= 0.5*sizeSignPix;
    yPixUp -= 0.5*sizeSignPix;
    xPixEnd -= 0.5*sizeSignPix;
    yPixEnd -= 0.5*sizeSignPix;

    ctx.setTransform(1,0,0,1,0,0); 
    ctx.drawImage(signUphillImg,xPixUp,yPixUp,sizeSignPix,sizeSignPix);
    ctx.drawImage(signFreeImg,xPixEnd,yPixEnd,sizeSignPix,sizeSignPix);
    if(banIsActive){// defined/changed in control_gui.js
	  ctx.drawImage(signTruckOvertakingBan,xPixBan,yPixBan,
			sizeSignPix,sizeSignPix);
    }

  }

  // (5a) draw traffic objects 

  if(userCanDropObjects&&(!isSmartphone)){
    trafficObjs.draw(scale);
  }

  // (5b) draw speedlimit-change select box

  ctx.setTransform(1,0,0,1,0,0); 
  drawSpeedlBox();



    // (6) draw simulated time

  displayTime(time,textsize);


    // (7) draw the speed colormap (as of 2020-01 drawColormap=false)

  if(drawColormap){
      displayColormap(0.22*refSizePix,
                 0.43*refSizePix,
                 0.1*refSizePix, 0.2*refSizePix,
		 vmin_col,vmax_col,0,100/3.6);
  }


  // reset even-oriented graphic switches (MT 2020-01)
  
  hasChanged=false; // window dimension has changed (responsive design)
  backgroundJustDrawn=false; // MT 2020-01 only redraw signs etc if necessary
  

  // revert to neutral transformation at the end!
  
  ctx.setTransform(1,0,0,1,0,0);
  
} // drawSim
 


 //##################################################
// Running function of the sim thread (triggered by setInterval)
//##################################################

function main_loop() {
  updateSim();
  drawSim();
  userCanvasManip=false; // may be set=true by some method
                        // during updateSim/drawSim
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
showInfo();
var myRun=setInterval(main_loop, 1000/fps);



 
