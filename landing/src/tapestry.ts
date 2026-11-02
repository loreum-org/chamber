/*
 * Scenes from the Bayeux Tapestry (c. 1070), cropped for the landing page
 * cards. Photographs: 2017 Bayeux Museum / CNRS survey, public domain.
 */

export type Scene = { src: string; alt: string; scene: string };

const scene = (file: string, n: string, alt: string): Scene => ({
  src: `/art/${file}.jpg`,
  alt,
  scene: n,
});

export const TAPESTRY = {
  gatehouse: scene('gatehouse', '19', 'Norman knights ride against the castle of Rennes'),
  feast: scene('feast', '43', 'The Normans feast and Bishop Odo blesses the meal'),
  messengers: scene('messengers', '10', "Duke William's messengers stand before Guy of Ponthieu"),
  provisions: scene('provisions', '37', 'Men carry arms and drag a cart of wine to the ships'),
  crowning: scene('crowning', '29', 'The nobles offer Harold the crown'),
  enthroned: scene('enthroned', '30', 'Harold sits enthroned as king'),
  shipbuilding: scene('shipbuilding', '35', "Shipwrights build William's fleet"),
  oath: scene('oath', '23', 'Harold swears an oath on holy relics before William'),
  keys: scene('keys', '20', 'The keys of Dinan are handed over on a lance'),
  council: scene('council', '35', 'Duke William in council orders ships to be built'),
};
