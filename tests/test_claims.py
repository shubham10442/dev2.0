def test_claim_and_handover_flow(client):
    # 1. Create
    create_res = client.post("/api/listings", json={
        "title": "20 Khichdi Bowls",
        "expires": "1h 30m",
        "donor": "Relief Caterer"
    })
    item_id = create_res.json()["data"]["id"]

    # 2. Claim
    claim_res = client.post(f"/api/listings/{item_id}/claim", json={
        "ngo": "Hope Shelter Network"
    })
    assert claim_res.status_code == 200
    assert claim_res.json()["success"] is True

    # 3. Duplicate Claim Prevention (should fail)
    dup_res = client.post(f"/api/listings/{item_id}/claim", json={"ngo": "Another NGO"})
    assert dup_res.status_code == 400

    # 4. Handover
    complete_res = client.post(f"/api/listings/{item_id}/complete")
    assert complete_res.status_code == 200