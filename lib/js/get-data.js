//adapted from the cerner smart on fhir guide. updated to utalize client.js v2 library and FHIR R4


var sodiumLevel = null;
var patientWeight = null;
// helper function to process fhir resource to get the patient name.
function getPatientName(pt) {
  if (pt.name) {
    var names = pt.name.map(function(name) {
      return name.given.join(" ") + " " + name.family;
    });
    return names.join(" / ")
  } else {
    return "anonymous";
  }
}

// display the patient name gender and dob in the index page
function displayPatient(pt) {
  document.getElementById('patient_name').innerHTML = getPatientName(pt);
  document.getElementById('gender').innerHTML = pt.gender;
  document.getElementById('dob').innerHTML = pt.birthDate;
}

//helper function to get quanity and unit from an observation resoruce.
function getQuantityValueAndUnit(ob) {
  if (typeof ob != 'undefined' &&
      typeof ob.valueQuantity != 'undefined' &&
      typeof ob.valueQuantity.value != 'undefined' &&
      typeof ob.valueQuantity.unit != 'undefined') {
    return Number(parseFloat((ob.valueQuantity.value)).toFixed(2)) + ' ' + ob.valueQuantity.unit;
  } else {
    return undefined;
  }
}

//helper function to get quanity  resoruce.
function getQuantityValueWithoutUnit(ob) {
  if (typeof ob != 'undefined' &&
      typeof ob.valueQuantity != 'undefined' &&
      typeof ob.valueQuantity.value != 'undefined' &&
      typeof ob.valueQuantity.unit != 'undefined') {
    return Number(parseFloat((ob.valueQuantity.value)).toFixed(2));
  } else {
    return undefined;
  }
}

//calculate hypernatremia
function totalWaterDeficit(desiredNa, serumNa, weight){
  let totalBodyWater;
  let waterDeficit;
  if (serumNa != 'undefined' && weight != 'undefined') {
    totalBodyWater = 0.5 * weight;
    waterDeficit = totalBodyWater - (desiredNa / serumNa);
    return waterDeficit.toFixed(2) + ' ' + 'L';
  }
  return "";
}

function sodiumRequirement(desiredNa, serumNa, weight){
  let totalBodyWater;
  let naRequirement;
  if (serumNa != 'undefined' && weight != 'undefined') {
    totalBodyWater = 0.5 * weight;
    naRequirement = totalBodyWater * (desiredNa - serumNa);
    return naRequirement.toFixed(2) + ' ' + 'mmol';
  }
  return "";
}


// helper function to get both systolic and diastolic bp
function getBloodPressureValue(BPObservations, typeOfPressure) {
  var formattedBPObservations = [];
  BPObservations.forEach(function(observation) {
    var BP = observation.component.find(function(component) {
      return component.code.coding.find(function(coding) {
        return coding.code == typeOfPressure;
      });
    });
    if (BP) {
      observation.valueQuantity = BP.valueQuantity;
      formattedBPObservations.push(observation);
    }
  });

  return getQuantityValueAndUnit(formattedBPObservations[0]);
}

// create a patient object to initalize the patient
function defaultPatient() {
  return {
    height: {
      value: ''
    },
    weight: {
      value: ''
    },
    sodium: {
      value: ''
    },
    // defWater: {
    //   value: ''
    // },
    // nareq: {
    //   value: ''
    // },
    note: 'No Annotation',
  };
}

//helper function to display the annotation on the index page
function displayAnnotation(annotation) {
  note.innerHTML = annotation;
}

//function to display the observation values you will need to update this
function displayObservation(obs) {
  weight.innerHTML =obs.weight;
  height.innerHTML =obs.height;
  sodium.innerHTML =obs.sodium;
  //defWater.innerHTML =obs.defWater;
  //nareq.innerHTML = obs.nareq;
  note.innerHTML = obs.note;
}

var weightObs = null;

//once fhir client is authorized then the following functions can be executed
FHIR.oauth2.ready().then(function(client) {

  // get patient object and then display its demographics info in the banner
  client.request(`Patient/${client.patient.id}`).then(
      function(patient) {
        displayPatient(patient);
        console.log(patient);
      }
  );


  // you will need to update the below to retrive the weight and height values
  var query = new URLSearchParams();


  query.set("patient", client.patient.id);
  query.set("_count", 100);
  query.set("_sort", "-date");
  query.set("code", [
    'http://loinc.org|8462-4',
    'http://loinc.org|8480-6',
    'http://loinc.org|2085-9',
    'http://loinc.org|2089-1',
    'http://loinc.org|55284-4',
    'http://loinc.org|3141-9',
    'http://loinc.org|3137-7',
    'http://loinc.org|8301-4',
    'http://loinc.org|8302-2',
    'http://loinc.org|8335-2',
    'http://loinc.org|29463-7',
    'http://loinc.org|2947-0', // add sodium levels
  ].join(","));

  client.request("Observation?" + query, {
    pageLimit: 0,
    flat: true
  }).then(
      function(ob) {

        // group all of the observation resoruces by type into their own
        var byCodes = client.byCodes(ob, 'code');
        var weight = byCodes('29463-7'); //use body weight code
        var height = byCodes('8302-2'); // use body height code
        var sodium = byCodes('2947-0');
        //var defWater = null;


        // create patient object
        var p = defaultPatient();

        // set patient value parameters to the data pulled from the observation resoruce
        p.weight = getQuantityValueAndUnit(weight[0]);
        p.height = getQuantityValueAndUnit(height[0]);
        p.sodium = getQuantityValueAndUnit(sodium[0]);
        sodiumLevel = getQuantityValueWithoutUnit(sodium[0]);
        patientWeight = getQuantityValueWithoutUnit(weight[0]);
        //p.defWater = totalWaterDeficit(140,getQuantityValue(sodium[0]),getQuantityValue(weight[0]));
        //p.nareq = sodiumRequirement(140,sodiumLevel,patientWeight);
        displayObservation(p)

      });


  function displayDiagnosis(){
    if(sodiumLevel > 142 && sodiumLevel != undefined){
      hyper.innerHTML = 'Serum sodium levels are too high. Treat patient with water according to deficit value indicated.';
    }
    else if (sodiumLevel < 137.5 && sodiumLevel != undefined){
      hyper.innerHTML = 'Serum sodium levels are too low. Treat patient with sodium according to sodium requirement value.'
    }
    else if (sodiumLevel > 137.5 && sodiumLevel < 142 && sodiumLevel != undefined){
      hyper.innerHTML = 'Serum sodium levels are optimal. No treatment needed.'
    }
    else if(sodiumLevel == undefined) {
      hyper.innerHTML = 'No information available on serum sodium of patient.'
    }
    else{
      hyper.innerHTML= 'Diagnosis cannot be made.'
    }
  }

  function displaySodiumReqandDeficit(){
    var desiredSodium = annotation.value;
    var deficitWater = totalWaterDeficit(desiredSodium, sodiumLevel, patientWeight);
    var sodiumReq = sodiumRequirement(desiredSodium,sodiumLevel,patientWeight);
    defWater.innerHTML = deficitWater;
    nareq.innerHTML = sodiumReq;

  }

  document.getElementById('add').addEventListener('click', displaySodiumReqandDeficit);

  //event listner when the a button is clicked to call the function that display diagnosis
  document.getElementById('diagButton').addEventListener('click', displayDiagnosis);

}).catch(console.error);
