export type NycodenzOneLayerInput = {
  stockPercent: number;
  targetPercent: number;
  totalVolume: number;
  availableVolume: number;
};

export type NycodenzTwoLayerInput = {
  stockPercent: number;
  targetPercent1: number;
  targetPercent2: number;
  totalVolume: number;
  availableVolume: number;
};

function dilutionVolume(stockPercent: number, targetPercent: number, targetVolume: number) {
  return targetVolume * targetPercent / stockPercent;
}

export function calculateNycodenzOneLayer(input: NycodenzOneLayerInput) {
  const nycodenzVolume = dilutionVolume(input.stockPercent, input.targetPercent, input.totalVolume);
  const gbssbVolume = input.totalVolume - input.availableVolume - nycodenzVolume;
  return { ...input, nycodenzVolume, gbssbVolume };
}

export function calculateNycodenzTwoLayers(input: NycodenzTwoLayerInput) {
  const layer1Total = input.totalVolume - input.availableVolume;
  const layer1Nycodenz = dilutionVolume(input.stockPercent, input.targetPercent1, layer1Total);
  const layer2Total = 4;
  const layer2Nycodenz = dilutionVolume(input.stockPercent, input.targetPercent2, layer2Total);
  return {
    ...input,
    layer1: { totalVolume: layer1Total, nycodenzVolume: layer1Nycodenz, gbssbVolume: layer1Total - layer1Nycodenz },
    layer2: { totalVolume: layer2Total, nycodenzVolume: layer2Nycodenz, gbssbVolume: layer2Total - layer2Nycodenz },
  };
}
