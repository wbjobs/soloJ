from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom
from datetime import datetime


NODE_TYPE_COLORS = {
    'ip': '#3498db',
    'domain': '#2ecc71',
    'organization': '#9b59b6'
}

NODE_TYPE_SIZES = {
    'ip': 20,
    'domain': 20,
    'organization': 30
}


def _make_id(name):
    return name.replace('.', '_').replace(' ', '_').replace('-', '_').replace('$', 'dollar')


def export_gexf(graph_data):
    gexf = Element('gexf')
    gexf.set('xmlns', 'http://www.gexf.net/1.3')
    gexf.set('xmlns:viz', 'http://www.gexf.net/1.3/viz')
    gexf.set('version', '1.3')
    gexf.set('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance')
    gexf.set('xsi:schemaLocation', 'http://www.gexf.net/1.3 http://www.gexf.net/1.3/gexf.xsd')

    meta = SubElement(gexf, 'meta')
    meta.set('lastmodifieddate', datetime.now().strftime('%Y-%m-%d'))
    creator = SubElement(meta, 'creator')
    creator.text = 'Threat Intelligence Knowledge Graph System'
    description = SubElement(meta, 'description')
    description.text = 'Exported threat intelligence knowledge graph'

    graph = SubElement(gexf, 'graph')
    graph.set('mode', 'static')
    graph.set('defaultedgetype', 'directed')

    attributes = SubElement(graph, 'attributes')
    attributes.set('class', 'node')
    attr_type = SubElement(attributes, 'attribute')
    attr_type.set('id', '0')
    attr_type.set('title', 'type')
    attr_type.set('type', 'string')
    attr_color = SubElement(attributes, 'attribute')
    attr_color.set('id', '1')
    attr_color.set('title', 'color')
    attr_color.set('type', 'string')

    edge_attributes = SubElement(graph, 'attributes')
    edge_attributes.set('class', 'edge')
    edge_attr = SubElement(edge_attributes, 'attribute')
    edge_attr.set('id', '0')
    edge_attr.set('title', 'relationship')
    edge_attr.set('type', 'string')

    nodes_elem = SubElement(graph, 'nodes')
    for node_data in graph_data.get('nodes', []):
        node = SubElement(nodes_elem, 'node')
        node_id = _make_id(node_data.get('name', node_data.get('id', '')))
        node.set('id', node_id)
        node.set('label', node_data.get('name', ''))

        node_type = node_data.get('type', 'unknown')
        color = NODE_TYPE_COLORS.get(node_type, '#cccccc')
        size = NODE_TYPE_SIZES.get(node_type, 20)

        attvalues = SubElement(node, 'attvalues')
        attvalue_type = SubElement(attvalues, 'attvalue')
        attvalue_type.set('for', '0')
        attvalue_type.set('value', node_type)
        attvalue_color = SubElement(attvalues, 'attvalue')
        attvalue_color.set('for', '1')
        attvalue_color.set('value', color)

        viz = SubElement(node, 'viz:size')
        viz.set('value', str(size))
        viz_color = SubElement(node, 'viz:color')
        viz_color.set('r', str(int(color[1:3], 16)))
        viz_color.set('g', str(int(color[3:5], 16)))
        viz_color.set('b', str(int(color[5:7], 16)))
        viz_color.set('a', '1.0')

    edges_elem = SubElement(graph, 'edges')
    seen_edge_ids = set()
    for i, edge_data in enumerate(graph_data.get('edges', [])):
        source_name = edge_data.get('source', '')
        target_name = edge_data.get('target', '')
        source_id = _make_id(source_name)
        target_id = _make_id(target_name)

        edge_id = source_id + '_' + target_id
        if edge_id in seen_edge_ids:
            edge_id = edge_id + '_' + str(i)
        seen_edge_ids.add(edge_id)

        edge = SubElement(edges_elem, 'edge')
        edge.set('id', edge_id)
        edge.set('source', source_id)
        edge.set('target', target_id)
        edge.set('type', 'directed')
        edge.set('label', edge_data.get('relationship', ''))

        edge_attvalues = SubElement(edge, 'attvalues')
        edge_attvalue = SubElement(edge_attvalues, 'attvalue')
        edge_attvalue.set('for', '0')
        edge_attvalue.set('value', edge_data.get('relationship', ''))

    raw_xml = tostring(gexf, encoding='unicode')
    pretty_xml = minidom.parseString(raw_xml).toprettyxml(indent='  ', encoding=None)

    lines = pretty_xml.split('\n')
    cleaned = []
    for line in lines:
        if line.strip():
            cleaned.append(line)

    return '\n'.join(cleaned)
