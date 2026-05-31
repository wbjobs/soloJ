import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")


def element_id_safe(node_or_rel):
    try:
        return node_or_rel.element_id
    except AttributeError:
        return str(node_or_rel.identity)


class Neo4jDB:
    def __init__(self):
        self.driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

    def close(self):
        self.driver.close()

    def create_ip_node(self, ip_address):
        with self.driver.session() as session:
            result = session.write_transaction(
                self._create_ip_node, ip_address
            )
            return result

    @staticmethod
    def _create_ip_node(tx, ip_address):
        query = """
        MERGE (ip:IP {address: $ip_address})
        ON CREATE SET ip.created_at = datetime()
        RETURN ip, elementId(ip) as id
        """
        result = tx.run(query, ip_address=ip_address)
        record = result.single()
        return {
            "id": record["id"],
            "label": "IP",
            "address": record["ip"]["address"]
        }

    def create_domain_node(self, domain_name):
        with self.driver.session() as session:
            result = session.write_transaction(
                self._create_domain_node, domain_name
            )
            return result

    @staticmethod
    def _create_domain_node(tx, domain_name):
        query = """
        MERGE (domain:Domain {name: $domain_name})
        ON CREATE SET domain.created_at = datetime()
        RETURN domain, elementId(domain) as id
        """
        result = tx.run(query, domain_name=domain_name)
        record = result.single()
        return {
            "id": record["id"],
            "label": "Domain",
            "name": record["domain"]["name"]
        }

    def create_organization_node(self, org_name):
        with self.driver.session() as session:
            result = session.write_transaction(
                self._create_organization_node, org_name
            )
            return result

    @staticmethod
    def _create_organization_node(tx, org_name):
        query = """
        MERGE (org:Organization {name: $org_name})
        ON CREATE SET org.created_at = datetime()
        RETURN org, elementId(org) as id
        """
        result = tx.run(query, org_name=org_name)
        record = result.single()
        return {
            "id": record["id"],
            "label": "Organization",
            "name": record["org"]["name"]
        }

    def create_attack_relationship(self, source_id, target_id, relationship_type, source_type, target_type):
        with self.driver.session() as session:
            result = session.write_transaction(
                self._create_attack_relationship, source_id, target_id, relationship_type, source_type, target_type
            )
            return result

    @staticmethod
    def _create_attack_relationship(tx, source_id, target_id, relationship_type, source_type, target_type):
        source_label = source_type.capitalize()
        target_label = target_type.capitalize()
        
        id_property = "address" if source_label == "IP" else "name"
        target_id_property = "address" if target_label == "IP" else "name"
        
        query = f"""
        MATCH (source:{source_label} {{{id_property}: $source_id}})
        MATCH (target:{target_label} {{{target_id_property}: $target_id}})
        MERGE (source)-[rel:{relationship_type}]->(target)
        ON CREATE SET rel.created_at = datetime()
        RETURN source, target, rel
        """
        result = tx.run(query, source_id=source_id, target_id=target_id, relationship_type=relationship_type)
        record = result.single()
        if record:
            return {
                "source": source_id,
                "target": target_id,
                "relationship": relationship_type
            }
        return None

    def get_all_graph_data(self):
        with self.driver.session() as session:
            result = session.read_transaction(self._get_all_graph_data)
            return result

    @staticmethod
    def _get_all_graph_data(tx):
        nodes_query = """
        MATCH (n)
        RETURN elementId(n) as id, labels(n)[0] as label, 
               CASE 
                 WHEN 'IP' IN labels(n) THEN n.address
                 WHEN 'Domain' IN labels(n) THEN n.name
                 WHEN 'Organization' IN labels(n) THEN n.name
               END as name,
               properties(n) as props
        """
        nodes_result = tx.run(nodes_query)
        nodes = []
        for record in nodes_result:
            node_type = record["label"].lower()
            display_name = record["name"]
            nodes.append({
                "id": record["id"],
                "type": node_type,
                "name": display_name,
                "label": record["label"]
            })

        edges_query = """
        MATCH (source)-[rel]->(target)
        RETURN elementId(source) as source, elementId(target) as target, type(rel) as relationship
        """
        edges_result = tx.run(edges_query)
        edges = []
        for record in edges_result:
            edges.append({
                "source": record["source"],
                "target": record["target"],
                "relationship": record["relationship"]
            })

        return {"nodes": nodes, "edges": edges}

    def find_shortest_path(self, source_name, source_type, target_name, target_type, max_depth=10):
        with self.driver.session() as session:
            result = session.read_transaction(
                self._find_shortest_path, source_name, source_type, target_name, target_type, max_depth
            )
            return result

    @staticmethod
    def _find_shortest_path(tx, source_name, source_type, target_name, target_type, max_depth):
        source_label = source_type.capitalize() if source_type else None
        target_label = target_type.capitalize() if target_type else None

        source_id_prop = "address" if source_label == "IP" else "name"
        target_id_prop = "address" if target_label == "IP" else "name"

        query = f"""
        MATCH (source:{source_label} {{{source_id_prop}: $source_name}}),
              (target:{target_label} {{{target_id_prop}: $target_name}})
        CALL apoc.algo.shortestPath(source, target, '', 'BOTH', 1, {max_depth}) YIELD path
        RETURN path
        """
        try:
            result = tx.run(query, source_name=source_name, target_name=target_name)
            record = result.single()
            if not record:
                query2 = f"""
                MATCH (source:{source_label} {{{source_id_prop}: $source_name}}),
                      (target:{target_label} {{{target_id_prop}: $target_name}})
                MATCH path = shortestPath((source)-[*..{max_depth}]-(target))
                RETURN path
                """
                result = tx.run(query2, source_name=source_name, target_name=target_name)
                record = result.single()
        except Exception:
            query3 = f"""
            MATCH (source:{source_label} {{{source_id_prop}: $source_name}}),
                  (target:{target_label} {{{target_id_prop}: $target_name}})
            MATCH path = shortestPath((source)-[*..{max_depth}]-(target))
            RETURN path
            """
            result = tx.run(query3, source_name=source_name, target_name=target_name)
            record = result.single()

        if not record:
            return None

        path = record["path"]
        nodes = []
        for node in path.nodes:
            labels = list(node.labels)
            label = labels[0] if labels else "Unknown"
            id_prop = "address" if label == "IP" else "name"
            nodes.append({
                "id": element_id_safe(node),
                "name": node[id_prop],
                "type": label.lower(),
                "label": label
            })

        edges = []
        for rel in path.relationships:
            edges.append({
                "source": element_id_safe(rel.start_node),
                "target": element_id_safe(rel.end_node),
                "relationship": rel.type
            })

        return {"nodes": nodes, "edges": edges}

    def clear_database(self):
        with self.driver.session() as session:
            session.write_transaction(self._clear_database)

    @staticmethod
    def _clear_database(tx):
        query = """
        MATCH (n)
        DETACH DELETE n
        """
        tx.run(query)


db = Neo4jDB()
