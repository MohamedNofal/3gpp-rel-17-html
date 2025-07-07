#!/usr/bin/env python3
import os
import json
from bs4 import BeautifulSoup
import re

def generate_index():
    """
    Generates manifest.json and search_data.json for the 3GPP HTML viewer.
    This script should be run from the '3gpp-rel-17-html' directory.
    It requires 'beautifulsoup4' and 'lxml' to be installed.
    pip install beautifulsoup4 lxml
    """
    root_dir = '.'
    manifest = {}
    search_docs = []
    
    print("Starting to index 3GPP HTML files...")

    # First, find all html files and group them by spec (directory name)
    for dirpath, _, filenames in os.walk(root_dir):
        spec_name = os.path.basename(dirpath)
        if dirpath == root_dir or spec_name == 'media' or spec_name.startswith('.'):
            continue
        
        if spec_name not in manifest:
            # A more friendly title
            title = spec_name
            manifest[spec_name] = {'id': spec_name, 'title': title, 'files': []}

        for filename in sorted(filenames):
            if not filename.endswith('.html'):
                continue

            filepath = os.path.join(dirpath, filename).replace('\\', '/')
            
            # Create a title for the file entry from its name
            file_title = os.path.splitext(filename)[0]
            # Clean up title for split files
            if f"_{spec_name}" in file_title:
                 file_title = file_title.replace(f"_{spec_name}", "")
            elif spec_name in file_title:
                file_title = file_title.replace(spec_name, "")
            
            file_title = file_title.replace('-', ' ').replace('_', ' ').strip()
            if not file_title: file_title = "Main"

            manifest[spec_name]['files'].append({'path': filepath, 'title': file_title})

            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    html_content = f.read()
            except Exception as e:
                print(f"Error reading {filepath}: {e}")
                continue

            soup = BeautifulSoup(html_content, 'lxml')
            doc_title_from_tag = soup.title.string.strip() if soup.title else os.path.basename(filepath)

            body = soup.find('body')
            if not body:
                continue

            toc_nav = soup.find('nav', id='TOC')
            if toc_nav:
                # Add TOC as a searchable document
                toc_text = toc_nav.get_text(separator=' ', strip=True)
                if toc_text:
                    search_docs.append({
                        'id': f"{filepath}#TOC_entire",
                        'title': f"TOC for {doc_title_from_tag}",
                        'body': toc_text,
                        'path': filepath, # Link to the document itself
                        'doc_path': filepath,
                        'doc_title': doc_title_from_tag
                    })

                toc_links = toc_nav.find_all('a', href=True)
                toc_targets = {a['href'].lstrip('#') for a in toc_links}
                
                for i, a_tag in enumerate(toc_links):
                    section_id = a_tag['href'].lstrip('#')
                    section_title = a_tag.get_text(strip=True, separator=' ')
                    if not section_title: continue

                    start_node = body.find(id=section_id)
                    if not start_node: continue
                    
                    # Include heading text
                    section_content = [start_node.get_text(separator=' ', strip=True)]
                    
                    # Find content until next TOC section
                    for element in start_node.find_next_siblings():
                        if element.name and element.name.startswith('h') and element.has_attr('id') and element['id'] in toc_targets:
                            break
                        section_content.append(element.get_text(separator=' ', strip=True))
                    
                    search_docs.append({
                        'id': f"{filepath}#{section_id}",
                        'title': section_title,
                        'body': ' '.join(section_content),
                        'path': f"{filepath}#{section_id}",
                        'doc_path': filepath,
                        'doc_title': doc_title_from_tag
                    })
            else: # Fallback for files without TOC
                search_docs.append({
                    'id': filepath,
                    'title': doc_title_from_tag,
                    'body': body.get_text(separator=' ', strip=True),
                    'path': filepath,
                    'doc_path': filepath,
                    'doc_title': doc_title_from_tag
                })
    
    sorted_manifest = sorted(manifest.values(), key=lambda x: x['id'])

    with open(os.path.join(root_dir, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(sorted_manifest, f, indent=2)
    
    with open(os.path.join(root_dir, 'search_data.json'), 'w', encoding='utf-8') as f:
        json.dump(search_docs, f) # no indent for smaller file size

    print(f"Generated manifest.json and search_data.json. Indexed {len(search_docs)} documents/sections.")


if __name__ == '__main__':
    generate_index()