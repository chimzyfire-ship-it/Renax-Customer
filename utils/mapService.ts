export const getActualDrivingDistance = async (
  pickupCoords: { lat: number; lon: number },
  deliveryCoords: { lat: number; lon: number }
): Promise<number> => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${pickupCoords.lon},${pickupCoords.lat};${deliveryCoords.lon},${deliveryCoords.lat}?overview=false`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('OSRM API returned an error');
    
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      const distanceMeters = data.routes[0].distance;
      const distanceKm = distanceMeters / 1000;
      return Math.round(distanceKm * 10) / 10; // Round to 1 decimal place
    }
    throw new Error('No routes found');
  } catch (error) {
    console.warn('Failed to fetch distance from OSRM, using fallback 15km:', error);
    return 15.0;
  }
};
