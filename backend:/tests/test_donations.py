def test_create_and_query_listings(client):
    payload = {
        "title": "50 Boxed Veg Meals",
        "expires": "2h 30m",
        "donor": "Royal Spice Caterers",
        "donorEmail": "chef.royalspice@gmail.com",
        "lat": 28.6139,
        "lng": 77.2090
    }
    create_res = client.post("/api/listings", json=payload)
    assert create_res.status_code == 200
    created_id = create_res.json()["data"]["id"]

    # Query listings
    list_res = client.get("/api/listings?q=Boxed")
    assert list_res.status_code == 200
    items = list_res.json()["data"]
    assert any(i["id"] == created_id for i in items)