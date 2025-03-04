
const userCanDropObjects=true;
//var drawVehIDs=false; // defined in control_gui.js

//#############################################################
// adapt/override standard param settings from control_gui.js
//#############################################################

MOBIL_mandat_bSafe=18;
MOBIL_mandat_bThr=0.5;   // >0
MOBIL_mandat_bias=1.5;

MOBIL_bSafe=5;
MOBIL_bSafeMax=17;

density=0;

qIn=1850/3600; //1850
commaDigits=0;
setSlider(slider_qIn, slider_qInVal, 3600*qIn, commaDigits, "veh/h");

IDM_a=2.05;
setSlider(slider_IDM_a, slider_IDM_aVal, IDM_a, 1, "m/s<sup>2</sup>");

//speedlimit now in trafficObjects

fracTruck=0.25;
setSlider(slider_fracTruck, slider_fracTruckVal, 100*fracTruck, 0, "%");


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

var scenarioString="RoadWorks";
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

var refSizePhys=(isSmartphone) ? 150 : 250;  // constant


var critAspectRatio=120./95.; // from css file width/height of #contents

var refSizePix=Math.min(canvas.height,canvas.width/critAspectRatio);
var scale=refSizePix/refSizePhys;

//##################################################################
// Specification of physical road geometry and vehicle properties
// If refSizePhys changes, change them all => updateDimensions();
//##################################################################

// all relative "Rel" settings with respect to refSizePhys, not refSizePix!

var center_xRel=0.43; // manipulae relative viewport by traj_x
var center_yRel=-0.55;
var arcRadiusRel=0.35;

var center_xPhys=center_xRel*refSizePhys; //[m]
var center_yPhys=center_yRel*refSizePhys;

var arcRadius=arcRadiusRel*refSizePhys;
var arcLen=arcRadius*Math.PI;
var straightLen=refSizePhys*critAspectRatio-center_xPhys;
var mainroadLen=arcLen+2*straightLen;

var uBeginRoadworks=straightLen+0.8*arcLen;
var uEndRoadworks=straightLen+1.1*arcLen;
var uStartLCMandatory=0.1*uBeginRoadworks; // uStart>u>uBeginR => mandat LC


function updateDimensions(){ // if viewport or sizePhys changed
    center_xPhys=center_xRel*refSizePhys; //[m]
    center_yPhys=center_yRel*refSizePhys;

    arcRadius=arcRadiusRel*refSizePhys;
    arcLen=arcRadius*Math.PI;
    straightLen=refSizePhys*critAspectRatio-center_xPhys;
    mainroadLen=arcLen+2*straightLen;

    uBeginRoadworks=straightLen+0.8*arcLen;
    uEndRoadworks=straightLen+1.1*arcLen;
    uStartLCMandatory=0.1*uBeginRoadworks;

}



// the following remains constant 
// => road becomes more compact for smaller screens

var laneWidth=7; // remains constant => road becomes more compact for smaller
var nLanes_main=2;

var car_length=7; // car length in m
var car_width=5; // car width in m
var truck_length=15; // trucks
var truck_width=7; 

var laneRoadwork=0;  // 0=left
var lenRoadworkElement=7;
var wRoadworkElement=7;


// on constructing road, road elements are gridded and interna
// road.traj_xy(u) are generated. Then, main.traj_xy*(u) obsolete


function traj_x(u){ // physical coordinates
        var dxPhysFromCenter= // left side (median), phys coordinates
	    (u<straightLen) ? straightLen-u
	  : (u>straightLen+arcLen) ? u-mainroadLen+straightLen
	  : -arcRadius*Math.sin((u-straightLen)/arcRadius);
	return center_xPhys+dxPhysFromCenter+6; //!!! quick hack
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

var isRing=false;  // 0: false; 1: true
var roadID=1;
var speedInit=20; // IC for speed
var fracTruckToleratedMismatch=1.0; // 100% allowed=>changes only by sources

var mainroad=new road(roadID,mainroadLen,laneWidth,nLanes_main,
		      [traj_x,traj_y],
		      density, speedInit,fracTruck, isRing);

// network declared in canvas_gui.js
network[0]=mainroad;  
network[0].drawVehIDs=drawVehIDs;

mainroad.uminLC=0; // allow lane changing right at the beginning
mainroad.setTrucksAlwaysRight=false;

//#########################################################
// add standing virtual vehicles at position of road works 
//#########################################################

// number of virtual "roadwork" Fzicles

var nr=Math.round((uEndRoadworks-uBeginRoadworks)/lenRoadworkElement);

for (var ir=0; ir<nr; ir++){
    var u=uBeginRoadworks+(ir+0.5)*lenRoadworkElement;
    var virtualVeh=new vehicle(lenRoadworkElement, wRoadworkElement, 
					u,laneRoadwork, 0, "obstacle");
    //virtualVeh.longModel=longModelObstacle;
    mainroad.veh.push(virtualVeh); // append; prepend=unshift
}

// put roadwork obstacles at right place and let vehicles get context of them 

mainroad.sortVehicles();
mainroad.updateEnvironment();


//  introduce stationary detectors 

var nDet=3;
var detectors=[];
detectors[0]=new stationaryDetector(mainroad,0.25*mainroadLen,30);
detectors[1]=new stationaryDetector(mainroad,0.60*mainroadLen,30);
detectors[2]=new stationaryDetector(mainroad,0.75*mainroadLen,30);


//#########################################################
// model initialization (models and methods defined in control_gui.js)
//#########################################################
	
updateModels(); // defines longModelCar,-Truck,LCModelCar,-Truck,-Mandatory


//####################################################################
// Global graphics specification 
//####################################################################


var hasChanged=true; // window dimensions have changed (responsive design)

var drawBackground=true; // if false, default unicolor background
var drawRoad=true; // if false, only vehicles are drawn
var userCanvasManip; // true only if used-driven geometry changes finished

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

//############################################
// traffic objects
//############################################

// TrafficObjects(canvas,nTL,nLimit,xRelDepot,yRelDepot,nRow,nCol)
var trafficObjs=new TrafficObjects(canvas,0,3,0.60,0.50,3,2);
var trafficLightControl=new TrafficLightControlEditor(trafficObjs,0.5,0.5);

// initialize one speedlimit on road
// the selected trafficObj needs to be of type speedlimit! not checked!
// default/init values 60,80,100; select the second object trafficObj[1]

var speedl=trafficObjs.trafficObj[1]; 
//activate(trafficObject,road,u) or activate(trafficObject,road)
trafficObjs.activate(speedl,mainroad,30);
trafficObjs.active_drawTopSign=false; // false=>only bottom sign drawn

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

  // (2a) update moveable speed limits

  for(var i=0; i<network.length; i++){
    network[i].updateSpeedlimits(trafficObjs);
  }


    // (2b) externally impose mandatory LC behaviour
    // all left-lane vehicles must change lanes to the right
    // starting at 0 up to the position uBeginRoadworks

    mainroad.setLCMandatory(uStartLCMandatory, uBeginRoadworks, true);


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


    for(var iDet=0; iDet<nDet; iDet++){
	detectors[iDet].update(time,dt);
    }


  if(userCanDropObjects&&(!isSmartphone)&&(!trafficObjPicked)){
    trafficObjs.zoomBack();
  }

    // debug output

  if(false){

    //if((itime>=125)&&(itime<=128)){
    if(false){
	console.log("updateSim: Simulation time=",time,
		    " itime=",itime);
	console.log("\nmainroad vehicles:");
	mainroad.writeVehiclesSimple();
	//console.log("\nonramp vehicles:");
	ramp.writeVehiclesSimple();
    }

    if(true){
      trafficObjs.writeObjects();
    }
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
      trafficObjs.calcDepotPositions(canvas); 

	if(true){
	    console.log("haschanged=true: new canvas dimension: ",
		        canvas.width," X ",canvas.height);
	}


    }


    // (1) update heading of all vehicles rel. to road axis
    // (for some reason, strange rotations at beginning)

    
  // (2) reset transform matrix and draw background
  // (only needed if changes, plus "reminders" for lazy browsers)

  ctx.setTransform(1,0,0,1,0,0);
  if(drawBackground){
    if(hasChanged||(itime<=10) || (itime%50==0) || userCanvasManip
      || (!drawRoad)){
      ctx.drawImage(background,0,0,canvas.width,canvas.height);
    }
  }


 

    // (3) draw mainroad
    // (always drawn; but changedGeometry=true necessary
    // if changed (it triggers building a new lookup table). 
    // Otherwise, road drawn at old position

    
    var changedGeometry=userCanvasManip || hasChanged||(itime<=1); 
    mainroad.draw(roadImg1,roadImg2,scale,changedGeometry);


 
    // (4) draw vehicles

    mainroad.drawVehicles(carImg,truckImg,obstacleImgs,scale,
			  vmin_col, vmax_col);
    
    // (4a) implement varying speed-limit signs! -> uphill as template

  /*
    var speedlimit_kmh=10*Math.round(3.6*longModelCar.speedlimit/10.);
    var speedL_srcFileIndex=Math.min(speedlimit_kmh/10,13);
    if( (speedL_srcFileIndex !=speedL_srcFileIndexOld)||hasChanged
	||userCanvasManip || (itime<=1) ){

	speedL_srcFileIndexOld=speedL_srcFileIndex;
	speedlimitImg=speedlimitImgs[speedL_srcFileIndex];
	//console.log("speedlimitImg.src=",speedlimitImg.src);

	var sizeSignPix=0.12*refSizePix;
	var vOffset=-1.8*nLanes_main*laneWidth; // in v direction, pos if right

	var xPix=mainroad.get_xPix(0.16*mainroadLen,vOffset,scale);
	var yPix=mainroad.get_yPix(0.16*mainroadLen,vOffset,scale);
	xPix -= 0.5*sizeSignPix; // center of sign
	yPix -= 0.5*sizeSignPix;
	ctx.setTransform(1,0,0,1,0,0); 
	//console.log("roadworks.draw: before drawing speedlimitImg");
	ctx.drawImage(speedlimitImg,xPix,yPix,sizeSignPix,sizeSignPix);
    }
  */
  
  // (5a) draw traffic objects 

  if(userCanDropObjects&&(!isSmartphone)){
    trafficObjs.draw(scale);
  }

  // (5b) draw speedlimit-change select box

  ctx.setTransform(1,0,0,1,0,0); 
  drawSpeedlBox();



    // (6) show simulation time and detector displays

    displayTime(time,textsize);
    for(var iDet=0; iDet<nDet; iDet++){
	detectors[iDet].display(textsize);
    }


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
 
} // drawSim
 

 //##################################################
// Running function of the sim thread (triggered by setInterval)
//##################################################

function main_loop() {
    updateSim();
    drawSim();
    userCanvasManip=false;
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



 
