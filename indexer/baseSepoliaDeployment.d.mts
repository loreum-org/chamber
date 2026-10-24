export type BaseSepoliaDeployment = {
  factory: `0x${string}`;
  factoryStartBlock: number;
};

export function parseBaseSepoliaDeployment(text: string): BaseSepoliaDeployment;
export function readBaseSepoliaDeployment(): BaseSepoliaDeployment;
