import os
from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
from dotenv import load_dotenv

from graph_service import build_graph_from_text, get_graph_data, clear_graph
from nlp_extractor import extract_entities as extract_all_entities
from nlp_extractor import MAX_TEXT_LENGTH
from gexf_exporter import export_gexf

load_dotenv()

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)


@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')


@app.route('/api/extract', methods=['POST'])
def extract_entities():
    try:
        data = request.get_json()
        text = data.get('text', '')
        
        if not text:
            return jsonify({'error': 'Text is required'}), 400
        
        if len(text) > MAX_TEXT_LENGTH:
            return jsonify({
                'error': f'Text too long. Maximum allowed: {MAX_TEXT_LENGTH} characters (about 100KB)'
            }), 400
        
        entities = extract_all_entities(text)
        
        return jsonify({
            'success': True,
            'entities': entities
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/build-graph', methods=['POST'])
def build_graph():
    try:
        data = request.get_json()
        text = data.get('text', '')
        
        if not text:
            return jsonify({'error': 'Text is required'}), 400
        
        if len(text) > MAX_TEXT_LENGTH:
            return jsonify({
                'error': f'Text too long. Maximum allowed: {MAX_TEXT_LENGTH} characters (about 100KB)'
            }), 400
        
        result = build_graph_from_text(text)
        
        return jsonify({
            'success': True,
            'result': result
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/graph', methods=['GET'])
def get_graph():
    try:
        graph_data = get_graph_data()
        
        return jsonify({
            'success': True,
            'data': graph_data
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/graph/clear', methods=['DELETE'])
def clear_graph_data():
    try:
        result = clear_graph()
        
        return jsonify({
            'success': True,
            'message': result['message']
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/shortest-path', methods=['POST'])
def shortest_path():
    try:
        data = request.get_json()
        source_name = data.get('source_name', '')
        source_type = data.get('source_type', '')
        target_name = data.get('target_name', '')
        target_type = data.get('target_type', '')
        max_depth = data.get('max_depth', 10)

        if not source_name or not target_name:
            return jsonify({'error': 'source_name and target_name are required'}), 400

        if not source_type or not target_type:
            return jsonify({'error': 'source_type and target_type are required'}), 400

        from neo4j_db import db
        result = db.find_shortest_path(
            source_name, source_type, target_name, target_type, max_depth
        )

        if result is None:
            return jsonify({
                'success': True,
                'found': False,
                'message': 'No path found between the two nodes'
            })

        return jsonify({
            'success': True,
            'found': True,
            'path': result
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/export/gexf', methods=['GET'])
def export_gexf_file():
    try:
        graph_data = get_graph_data()
        gexf_content = export_gexf(graph_data)

        return Response(
            gexf_content,
            mimetype='application/xml',
            headers={
                'Content-Disposition': 'attachment; filename=threat_intelligence_graph.gexf'
            }
        )

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'success': True,
        'status': 'healthy'
    })


if __name__ == '__main__':
    host = os.getenv('FLASK_HOST', '0.0.0.0')
    port = int(os.getenv('FLASK_PORT', 5000))
    
    print(f"Starting Threat Intelligence Knowledge Graph API")
    print(f"Server running on http://{host}:{port}")
    print(f"Frontend available at http://{host}:{port}/")
    
    app.run(host=host, port=port, debug=True)
