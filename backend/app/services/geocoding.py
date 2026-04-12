import requests
from fastapi import HTTPException


def get_coordinates_from_address(address: str):
    """
    Zamienia adres tekstowy na współrzędne geograficzne przy użyciu Nominatim API[cite: 31, 46].
    """
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": address,
        "format": "json",
        "limit": 1
    }
    # Nominatim wymaga podania User-Agent zgodnie z polityką Usage Policy [cite: 31]
    headers = {
        "User-Agent": "FriendSync_App/1.0"
    }

    try:
        response = requests.get(url, params=params, headers=headers)
        data = response.json()

        if not data:
            raise HTTPException(status_code=404, detail="Nie znaleziono podanego adresu w usłudze Nominatim.")

        return {
            "lat": float(data[0]["lat"]),
            "lon": float(data[0]["lon"])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd komunikacji z API Geocodingu: {str(e)}")