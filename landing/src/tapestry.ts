/*
 * The "Loreum Tapestry": Bayeux-style embroidered panels, with aliens and
 * starships, for the landing page cards. Drawn as SVG and rendered to JPEG.
 */

export type Scene = { src: string; alt: string; panel: string };

const scene = (file: string, panel: string, alt: string): Scene => ({
  src: `/art/${file}.jpg`,
  alt,
  panel,
});

export const TAPESTRY = {
  gatehouse: scene('gatehouse', 'I', 'Aliens on flying saucers approach a castle whose gate is shut'),
  feast: scene('feast', 'II', 'Aliens feast at a long table, each voting on a glowing tablet'),
  messengers: scene('messengers', 'III', 'Alien messengers and a robot stand beside an empty seat'),
  provisions: scene('provisions', 'IV', 'Aliens carry crates of gold to a starship'),
  crowning: scene('crowning', 'V', 'Aliens hand a crown to the one they elected'),
  enthroned: scene('enthroned', 'VI', 'An alien king sits enthroned among aliens and a robot'),
  shipbuilding: scene('shipbuilding', 'VII', 'Alien shipwrights build a starship'),
  oath: scene('oath', 'VIII', 'An alien swears an oath on a machine before the duke'),
  keys: scene('keys', 'IX', 'The keys of the castle are passed on a lance to an alien in a saucer'),
  council: scene('council', 'X', 'An alien duke sits in council with a robot'),
};
