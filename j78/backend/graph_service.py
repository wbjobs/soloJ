from neo4j_db import db
from nlp_extractor import extract_all_entities, infer_relationships


def build_graph_from_text(text):
    entities = extract_all_entities(text)
    relationships = infer_relationships(entities, text)
    
    created_nodes = {
        "ips": [],
        "domains": [],
        "organizations": []
    }
    
    for ip in entities["ips"]:
        node = db.create_ip_node(ip)
        created_nodes["ips"].append(node)
    
    for domain in entities["domains"]:
        node = db.create_domain_node(domain)
        created_nodes["domains"].append(node)
    
    for org in entities["organizations"]:
        node = db.create_organization_node(org)
        created_nodes["organizations"].append(node)
    
    created_relationships = []
    for rel in relationships:
        result = db.create_attack_relationship(
            rel["source"],
            rel["target"],
            rel["relationship"],
            rel["source_type"],
            rel["target_type"]
        )
        if result:
            created_relationships.append(result)
    
    return {
        "entities": entities,
        "nodes": created_nodes,
        "relationships": created_relationships
    }


def get_graph_data():
    return db.get_all_graph_data()


def clear_graph():
    db.clear_database()
    return {"message": "Graph cleared successfully"}
