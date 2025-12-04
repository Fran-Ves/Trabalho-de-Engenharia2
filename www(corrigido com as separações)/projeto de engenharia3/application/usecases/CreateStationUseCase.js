export class CreateStationUseCase {
  constructor(stationRepository) {
    this.stationRepository = stationRepository;
  }

  async execute(stationData) {
    const station = {
      id: 'posto_' + Date.now(),
      ...stationData,
      isVerified: true,
      trustScore: 10,
      pendingChanges: []
    };
    
    await this.stationRepository.save(station);
    return station;
  }
}