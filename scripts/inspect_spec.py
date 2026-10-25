import json

with open("swagger_spec.json", "r") as f:
    spec = json.load(f)

endpoints = [
    "/datasets/FUELHH",
    "/datasets/FUELHH/stream",
    "/datasets/WINDFOR",
    "/datasets/WINDFOR/stream",
]

for ep in endpoints:
    print("=" * 60)
    print("ENDPOINT:", ep)
    ep_data = spec["paths"].get(ep, {})
    get_op = ep_data.get("get", {})
    print("Summary:", get_op.get("summary"))
    print("Description:", get_op.get("description"))
    params = get_op.get("parameters", [])
    print("Parameters:")
    for p in params:
        name = p.get("name")
        req = p.get("required", False)
        schema = p.get("schema", {})
        desc = p.get("description", "")
        print(f"  - {name} (required={req}, type={schema.get('type')}, format={schema.get('format')}): {desc}")
    responses = get_op.get("responses", {})
    for r_code, r_val in responses.items():
        content = r_val.get("content", {})
        print(f"  Response {r_code} media types: {list(content.keys())}")
        for m, m_val in content.items():
            schema_ref = m_val.get("schema", {}).get("$ref") or m_val.get("schema", {}).get("type")
            print(f"    Schema: {schema_ref}")
